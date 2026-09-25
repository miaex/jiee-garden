// A lightweight 2D (XZ plane) collision world.
// Obstacles are axis-aligned boxes. Characters are treated as circles.
// This is intentionally simple (no physics engine) so it stays cheap on mobile,
// while still giving coherent blocking + line-of-sight behaviour.

export class CollisionWorld {
  constructor() {
    /** @type {{minX:number,maxX:number,minZ:number,maxZ:number,blocksVision:boolean,blocksMovement:boolean}[]} */
    this.obstacles = [];
    this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  }

  setBounds(minX, maxX, minZ, maxZ) {
    this.bounds = { minX, maxX, minZ, maxZ };
  }

  /**
   * @param {number} x center x
   * @param {number} z center z
   * @param {number} width full width (X)
   * @param {number} depth full depth (Z)
   * @param {object} opts { blocksVision=true, blocksMovement=true }
   */
  addBox(x, z, width, depth, opts = {}) {
    const { blocksVision = true, blocksMovement = true } = opts;
    const box = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      blocksVision,
      blocksMovement
    };
    this.obstacles.push(box);
    return box;
  }

  // Push a circle (character) out of any overlapping movement-blocking obstacle.
  // Returns the corrected {x,z}.
  resolveCircle(x, z, radius) {
    let px = x;
    let pz = z;

    for (const box of this.obstacles) {
      if (!box.blocksMovement) continue;
      const closestX = Math.max(box.minX, Math.min(px, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(pz, box.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = radius - dist;
        px += (dx / dist) * push;
        pz += (dz / dist) * push;
      }
    }

    // Clamp to world bounds too.
    px = Math.max(this.bounds.minX + radius, Math.min(this.bounds.maxX - radius, px));
    pz = Math.max(this.bounds.minZ + radius, Math.min(this.bounds.maxZ - radius, pz));

    return { x: px, z: pz };
  }

  isWalkable(x, z, radius = 0.3) {
    for (const box of this.obstacles) {
      if (!box.blocksMovement) continue;
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        return false;
      }
    }
    return (
      x > this.bounds.minX + radius &&
      x < this.bounds.maxX - radius &&
      z > this.bounds.minZ + radius &&
      z < this.bounds.maxZ - radius
    );
  }

  // Segment vs AABB test (Liang-Barsky), used for line-of-sight / hiding behind hedges.
  lineOfSightBlocked(ax, az, bx, bz) {
    for (const box of this.obstacles) {
      if (!box.blocksVision) continue;
      if (this._segmentIntersectsBox(ax, az, bx, bz, box)) return true;
    }
    return false;
  }

  _segmentIntersectsBox(x0, z0, x1, z1, box) {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dz = z1 - z0;

    const clip = (p, q) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };

    if (!clip(-dx, x0 - box.minX)) return false;
    if (!clip(dx, box.maxX - x0)) return false;
    if (!clip(-dz, z0 - box.minZ)) return false;
    if (!clip(dz, box.maxZ - z0)) return false;

    return t0 < t1;
  }
}
