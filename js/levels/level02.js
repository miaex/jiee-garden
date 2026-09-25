// Level 2: same mechanics as level 1, but a denser hedge layout, three
// guards instead of two, tighter corridors, and wider guard vision — the
// kind of progression called for in section 21 of the brief (more
// obstacles / more guards / harder detection, not just "make them faster").

export const level02 = {
  id: 2,
  name: 'Le jardin resserré',
  lives: 5,

  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },

  playerStart: { x: -8, z: -8, facing: 0 },

  tontonJiee: { x: 8, z: 8 },

  hedges: [
    { x: -6, z: -7, width: 8, depth: 0.7 },
    { x: -2, z: -3, width: 0.7, depth: 8 },
    { x: 2, z: -5, width: 0.7, depth: 6 },
    { x: -6, z: 0, width: 8, depth: 0.7 },
    { x: 5, z: -2, width: 6, depth: 0.7 },
    { x: 8, z: 2, width: 0.7, depth: 8 },
    { x: -3, z: 4, width: 8, depth: 0.7 },
    { x: 1, z: 7, width: 0.7, depth: 6 },
    { x: -7, z: 6, width: 0.7, depth: 6 },
    { x: 4, z: 6, width: 6, depth: 0.7 }
  ],

  decorations: [
    { type: 'tree', x: -9, z: 4, scale: 1.1 },
    { type: 'tree', x: 9, z: -9, scale: 1 },
    { type: 'tree', x: -4, z: 9, scale: 1.1 },
    { type: 'tree', x: 0, z: -9, scale: 1 },
    { type: 'bush', x: -9, z: -2, scale: 0.8, solid: true },
    { type: 'bush', x: 6, z: -9, scale: 0.9, solid: true },
    { type: 'bush', x: -4, z: 7, scale: 0.8, solid: true },
    { type: 'statue', x: 0, z: 2, scale: 1, solid: true },
    { type: 'bench', x: 7, z: 7, scale: 1, solid: false },
    { type: 'pot', x: 5, z: 3, scale: 1, solid: true },
    { type: 'pot', x: -6, z: -9, scale: 1, solid: true },
    { type: 'fountain', x: 2, z: 9, scale: 1.1, solid: true }
  ],

  enemies: [
    {
      id: 'stress',
      name: 'STRESS',
      color: 0xb84a3e,
      speed: 1.9,
      chaseSpeed: 2.9,
      viewDistance: 6,
      viewAngleDeg: 72,
      waitAtPointMs: 450,
      patrol: [
        { x: -8, z: -4 },
        { x: -3, z: -4 },
        { x: -3, z: -1 },
        { x: -8, z: -1 }
      ]
    },
    {
      id: 'goumin',
      name: 'GOUMIN',
      color: 0x6a4a8a,
      speed: 1.9,
      chaseSpeed: 2.8,
      viewDistance: 6,
      viewAngleDeg: 75,
      waitAtPointMs: 450,
      patrol: [
        { x: 4, z: -7 },
        { x: 7, z: -7 },
        { x: 7, z: -4 },
        { x: 4, z: -4 }
      ]
    },
    {
      id: 'panique',
      name: 'PANIQUE',
      color: 0xc98a2c,
      speed: 2.1,
      chaseSpeed: 3.1,
      viewDistance: 6.5,
      viewAngleDeg: 78,
      waitAtPointMs: 350,
      patrol: [
        { x: 3, z: 8 },
        { x: 6, z: 8 },
        { x: 6, z: 9.5 },
        { x: 3, z: 9.5 }
      ]
    }
  ],

  positiveCharacters: [{ id: 'dje-2', name: 'DJÊ', x: -1, z: -8, effect: 'life' }]
};
