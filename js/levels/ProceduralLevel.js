import { hashSeed, mulberry32, pick, randRange } from './rng.js';

const ENEMY_NAME_POOL = [
  'STRESS', 'GOUMIN', 'PANIQUE', 'FATIGUE', 'DRAMA',
  'PROBLÈMES', 'DOUTE', 'PEUR', 'COLÈRE', 'ENNUI'
];
const ENEMY_COLOR_POOL = [0xb84a3e, 0x6a4a8a, 0xc98a2c, 0x3f7a8a, 0x8a3f6a, 0x5a7a3f];
const NAME_ADJECTIVES = ['secret', 'oublié', 'endormi', 'silencieux', 'ancien', 'caché', 'perdu', 'tranquille'];
const NAME_NOUNS = ['jardin', 'verger', 'bosquet', 'labyrinthe', 'sanctuaire', 'clos'];

/**
 * Builds a level from a grid maze (recursive-backtracker + light braiding
 * for loops/hiding routes), so hedge placement, patrol routes and the
 * Tonton Jiee goal are all derived from one connectivity graph — nothing
 * needs hand-tuned coordinates, and nothing can end up unreachable.
 */
export function generateProceduralLevel(levelNumber) {
  const rng = mulberry32(hashSeed(levelNumber));

  const gridSize = clamp(4 + Math.floor((levelNumber - 3) / 3), 4, 8);
  const cellSize = clamp(2.6 - levelNumber * 0.02, 1.85, 2.6);
  const wallThickness = 0.5;

  const grid = carveMaze(gridSize, rng);
  braid(grid, gridSize, rng, clamp(0.1 + levelNumber * 0.005, 0.1, 0.22));

  const half = (gridSize * cellSize) / 2;
  const cellCenter = (r, c) => ({ x: -half + (c + 0.5) * cellSize, z: -half + (r + 0.5) * cellSize });

  const goalCell = bfsFarthest(grid, gridSize, 0, 0);

  const hedges = buildHedges(grid, gridSize, cellSize, wallThickness, cellCenter);

  const guardCount = clamp(2 + Math.floor((levelNumber - 1) / 2), 2, 6);
  const duoChance = levelNumber >= 4 ? clamp(0.12 * (levelNumber - 3), 0, 0.55) : 0;

  const excludedCells = new Set([cellKey(0, 0), cellKey(goalCell.r, goalCell.c)]);
  const enemies = [];
  const usedNames = new Set();
  let guardsPlaced = 0;

  while (guardsPlaced < guardCount) {
    const hub = randomCell(rng, gridSize, excludedCells);
    if (!hub) break;
    const walkCells = randomWalk(grid, gridSize, hub, rng, 4 + Math.floor(rng() * 3));
    if (walkCells.length < 3) continue;

    const patrol = walkCells.map(({ r, c }) => cellCenter(r, c));
    const name = pickUnique(rng, ENEMY_NAME_POOL, usedNames);
    const color = pick(rng, ENEMY_COLOR_POOL);
    const baseCfg = enemyStatsForLevel(levelNumber, rng);

    enemies.push({
      id: `${name.toLowerCase()}-${guardsPlaced}`,
      name,
      color,
      patrol,
      ...baseCfg
    });
    guardsPlaced++;

    // Occasionally spawn a partner on the SAME patrol loop, started at the
    // opposite point in the cycle — a "duo" that covers a corridor from
    // both directions at once instead of two independent guards.
    if (guardsPlaced < guardCount + 2 && rng() < duoChance) {
      const partnerName = pickUnique(rng, ENEMY_NAME_POOL, usedNames);
      enemies.push({
        id: `${partnerName.toLowerCase()}-${guardsPlaced}`,
        name: partnerName,
        color: pick(rng, ENEMY_COLOR_POOL),
        patrol,
        startPatrolIndex: Math.floor(patrol.length / 2),
        ...enemyStatsForLevel(levelNumber, rng)
      });
      guardsPlaced++;
    }
  }

  const positiveCharacters = [];
  const spawnPositiveChance = Math.max(0.3, 1 - levelNumber * 0.02);
  if (rng() < spawnPositiveChance) {
    const cell = randomCell(rng, gridSize, excludedCells);
    if (cell) {
      const { x, z } = cellCenter(cell.r, cell.c);
      positiveCharacters.push({ id: `dje-${levelNumber}`, name: 'DJÊ', x, z, effect: 'life' });
    }
  }

  const decorations = buildDecorations(grid, gridSize, rng, cellCenter, excludedCells);

  const start = cellCenter(0, 0);
  const goal = cellCenter(goalCell.r, goalCell.c);

  return {
    id: levelNumber,
    name: `Le ${pick(rng, NAME_ADJECTIVES)} ${pick(rng, NAME_NOUNS)}`,
    lives: 5,
    procedural: true,
    bounds: { minX: -half - 1, maxX: half + 1, minZ: -half - 1, maxZ: half + 1 },
    playerStart: { x: start.x, z: start.z, facing: 0 },
    tontonJiee: { x: goal.x, z: goal.z },
    hedges,
    decorations,
    enemies,
    positiveCharacters
  };
}

function enemyStatsForLevel(levelNumber, rng) {
  return {
    speed: clamp(1.6 + levelNumber * 0.045 + randRange(rng, -0.05, 0.05), 1.6, 2.7),
    chaseSpeed: clamp(2.5 + levelNumber * 0.05, 2.5, 3.6),
    viewDistance: clamp(5 + levelNumber * 0.08, 5, 7.5),
    viewAngleDeg: clamp(68 + levelNumber * 0.6, 68, 86),
    waitAtPointMs: clamp(550 - levelNumber * 12, 250, 550)
  };
}

function buildHedges(grid, N, cellSize, thickness, cellCenter) {
  const hedges = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = grid[r][c];
      const { x, z } = cellCenter(r, c);
      if (c === N - 1 || !cell.E) {
        hedges.push({ x: x + cellSize / 2, z, width: thickness, depth: cellSize + thickness });
      }
      if (r === N - 1 || !cell.S) {
        hedges.push({ x, z: z + cellSize / 2, width: cellSize + thickness, depth: thickness });
      }
    }
  }
  for (let r = 0; r < N; r++) {
    const { x, z } = cellCenter(r, 0);
    hedges.push({ x: x - cellSize / 2, z, width: thickness, depth: cellSize + thickness });
  }
  for (let c = 0; c < N; c++) {
    const { x, z } = cellCenter(0, c);
    hedges.push({ x, z: z - cellSize / 2, width: cellSize + thickness, depth: thickness });
  }
  return hedges;
}

function buildDecorations(grid, N, rng, cellCenter, excludedCells) {
  const decorations = [];
  const types = ['tree', 'bush', 'bench', 'pot'];
  const count = Math.min(N * 2, 14);
  for (let i = 0; i < count; i++) {
    const cell = randomCell(rng, N, excludedCells);
    if (!cell) continue;
    const { x, z } = cellCenter(cell.r, cell.c);
    const type = pick(rng, types);
    // Decorations in procedural levels stay non-solid: with the maze
    // topology generated fresh every level, a solid prop could otherwise
    // land somewhere that turns a tight corridor into a dead end.
    decorations.push({
      type,
      x: x + randRange(rng, -0.5, 0.5),
      z: z + randRange(rng, -0.5, 0.5),
      scale: randRange(rng, 0.8, 1.15),
      solid: false
    });
  }
  return decorations;
}

function randomWalk(grid, N, start, rng, steps) {
  const path = [start];
  let current = start;
  for (let i = 0; i < steps; i++) {
    const options = neighborsOf(grid, N, current);
    if (!options.length) break;
    current = pick(rng, options);
    path.push(current);
  }
  return path;
}

function neighborsOf(grid, N, { r, c }) {
  const cell = grid[r][c];
  const out = [];
  if (cell.N && r > 0) out.push({ r: r - 1, c });
  if (cell.S && r < N - 1) out.push({ r: r + 1, c });
  if (cell.E && c < N - 1) out.push({ r, c: c + 1 });
  if (cell.W && c > 0) out.push({ r, c: c - 1 });
  return out;
}

function randomCell(rng, N, excluded, maxTries = 30) {
  for (let i = 0; i < maxTries; i++) {
    const r = Math.floor(rng() * N);
    const c = Math.floor(rng() * N);
    const key = cellKey(r, c);
    if (!excluded.has(key)) {
      excluded.add(key);
      return { r, c };
    }
  }
  return null;
}

function cellKey(r, c) {
  return `${r},${c}`;
}

function pickUnique(rng, pool, used) {
  const available = pool.filter((n) => !used.has(n));
  const chosen = available.length ? pick(rng, available) : pick(rng, pool);
  used.add(chosen);
  return chosen;
}

function carveMaze(N, rng) {
  const grid = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ N: false, E: false, S: false, W: false, visited: false }))
  );
  const stack = [{ r: 0, c: 0 }];
  grid[0][0].visited = true;

  while (stack.length) {
    const { r, c } = stack[stack.length - 1];
    const dirs = shuffle(
      [
        { dr: -1, dc: 0, from: 'N', to: 'S' },
        { dr: 1, dc: 0, from: 'S', to: 'N' },
        { dr: 0, dc: -1, from: 'W', to: 'E' },
        { dr: 0, dc: 1, from: 'E', to: 'W' }
      ],
      rng
    );

    let carved = false;
    for (const d of dirs) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      if (grid[nr][nc].visited) continue;
      grid[r][c][d.from] = true;
      grid[nr][nc][d.to] = true;
      grid[nr][nc].visited = true;
      stack.push({ r: nr, c: nc });
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }
  return grid;
}

function braid(grid, N, rng, chance) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (c < N - 1 && !grid[r][c].E && rng() < chance) {
        grid[r][c].E = true;
        grid[r][c + 1].W = true;
      }
      if (r < N - 1 && !grid[r][c].S && rng() < chance) {
        grid[r][c].S = true;
        grid[r + 1][c].N = true;
      }
    }
  }
}

function bfsFarthest(grid, N, startR, startC) {
  const dist = Array.from({ length: N }, () => new Array(N).fill(-1));
  dist[startR][startC] = 0;
  const queue = [{ r: startR, c: startC }];
  let far = { r: startR, c: startC, d: 0 };

  while (queue.length) {
    const { r, c } = queue.shift();
    const d = dist[r][c];
    if (d > far.d) far = { r, c, d };
    const cell = grid[r][c];
    if (cell.N && r > 0 && dist[r - 1][c] === -1) {
      dist[r - 1][c] = d + 1;
      queue.push({ r: r - 1, c });
    }
    if (cell.S && r < N - 1 && dist[r + 1][c] === -1) {
      dist[r + 1][c] = d + 1;
      queue.push({ r: r + 1, c });
    }
    if (cell.E && c < N - 1 && dist[r][c + 1] === -1) {
      dist[r][c + 1] = d + 1;
      queue.push({ r, c: c + 1 });
    }
    if (cell.W && c > 0 && dist[r][c - 1] === -1) {
      dist[r][c - 1] = d + 1;
      queue.push({ r, c: c - 1 });
    }
  }
  return far;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
