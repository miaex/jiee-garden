// A coarse walkability grid built once per level from the same
// CollisionWorld the player uses. Guards use it only while CHASE/SEARCH
// need to reach an arbitrary point (the player's position) — patrol and
// return-to-post movement already follow hand-authored, hedge-free
// waypoints, so they don't need this.
//
// Kept intentionally simple (grid + A*, no navmesh) so it's cheap enough
// to rebuild per level and to query a few times a second per active guard
// on a phone, per the performance requirements in the spec.

export class NavGrid {
  constructor(collisionWorld, cellSize = 0.4, agentRadius = 0.3) {
    this.collisionWorld = collisionWorld;
    this.cellSize = cellSize;
    this.agentRadius = agentRadius;

    const b = collisionWorld.bounds;
    this.minX = b.minX;
    this.minZ = b.minZ;
    this.cols = Math.max(1, Math.ceil((b.maxX - b.minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((b.maxZ - b.minZ) / cellSize));
    this.walkable = new Uint8Array(this.cols * this.rows);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const { x, z } = this._cellCenter(c, r);
        this.walkable[r * this.cols + c] = collisionWorld.isWalkable(x, z, agentRadius) ? 1 : 0;
      }
    }
  }

  _cellCenter(c, r) {
    return { x: this.minX + (c + 0.5) * this.cellSize, z: this.minZ + (r + 0.5) * this.cellSize };
  }

  _toCell(x, z) {
    const c = clamp(Math.floor((x - this.minX) / this.cellSize), 0, this.cols - 1);
    const r = clamp(Math.floor((z - this.minZ) / this.cellSize), 0, this.rows - 1);
    return { c, r };
  }

  _idx(c, r) {
    return r * this.cols + c;
  }

  _isWalkable(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.walkable[this._idx(c, r)] === 1;
  }

  // BFS outward to the nearest walkable cell — used when a target (e.g.
  // the player, briefly) lands on a technically-blocked cell right at a
  // hedge's edge due to grid rounding.
  _nearestWalkable(c, r) {
    if (this._isWalkable(c, r)) return { c, r };
    const seen = new Set([`${c},${r}`]);
    let frontier = [{ c, r }];
    for (let ring = 0; ring < 6; ring++) {
      const next = [];
      for (const cell of frontier) {
        for (const [dc, dr] of NEIGHBORS8) {
          const nc = cell.c + dc;
          const nr = cell.r + dr;
          const key = `${nc},${nr}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (this._isWalkable(nc, nr)) return { c: nc, r: nr };
          next.push({ c: nc, r: nr });
        }
      }
      frontier = next;
    }
    return null;
  }

  /**
   * @returns {{x:number,z:number}[]|null} world-space waypoints (excludes
   * the start point), or null if no path could be found.
   */
  findPath(sx, sz, tx, tz) {
    const start = this._toCell(sx, sz);
    let goal = this._toCell(tx, tz);

    if (!this._isWalkable(goal.c, goal.r)) {
      const snapped = this._nearestWalkable(goal.c, goal.r);
      if (!snapped) return null;
      goal = snapped;
    }
    if (start.c === goal.c && start.r === goal.r) return [];

    const startKey = this._idx(start.c, start.r);
    const goalKey = this._idx(goal.c, goal.r);

    const gScore = new Map([[startKey, 0]]);
    const cameFrom = new Map();
    const open = [{ key: startKey, c: start.c, r: start.r, f: heuristic(start, goal) }];
    const closed = new Set();

    let iterations = 0;
    while (open.length && iterations < 3000) {
      iterations++;
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (current.key === goalKey) return this._reconstruct(cameFrom, current, goal);
      if (closed.has(current.key)) continue;
      closed.add(current.key);

      for (const [dc, dr] of NEIGHBORS8) {
        const nc = current.c + dc;
        const nr = current.r + dr;
        if (!this._isWalkable(nc, nr)) continue;
        // Disallow cutting diagonally across a wall corner.
        if (dc !== 0 && dr !== 0) {
          if (!this._isWalkable(current.c + dc, current.r) || !this._isWalkable(current.c, current.r + dr)) continue;
        }
        const nKey = this._idx(nc, nr);
        if (closed.has(nKey)) continue;
        const stepCost = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
        const tentativeG = gScore.get(current.key) + stepCost;
        if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
          gScore.set(nKey, tentativeG);
          cameFrom.set(nKey, current);
          open.push({ key: nKey, c: nc, r: nr, f: tentativeG + heuristic({ c: nc, r: nr }, goal) });
        }
      }
    }
    return null; // no path found within the search budget
  }

  _reconstruct(cameFrom, endNode, goal) {
    const cells = [{ c: endNode.c, r: endNode.r }];
    let node = endNode;
    while (cameFrom.has(node.key)) {
      node = cameFrom.get(node.key);
      cells.push({ c: node.c, r: node.r });
    }
    cells.reverse();
    cells.shift(); // drop the starting cell itself

    // Downsample: keep every other waypoint (plus the final one). The
    // grid is fine (0.4m) so a raw cell-by-cell path is jittery; this
    // keeps movement smooth without needing full string-pulling.
    const points = cells.map((cell) => this._cellCenter(cell.c, cell.r));
    const thinned = points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
    return thinned;
  }
}

const NEIGHBORS8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

function heuristic(a, b) {
  const dx = Math.abs(a.c - b.c);
  const dz = Math.abs(a.r - b.r);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); // octile distance
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
