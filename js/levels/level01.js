// Level configuration is pure data. The engine never hardcodes a layout;
// it reads this shape. New levels are added by writing a new file like this
// one and registering it in LevelLoader.js.
//
// Coordinates are in world units on the XZ ground plane (Y is up).
// Hedge/box segments intentionally never span the full width or depth of
// the garden, so there is always a way around them — this guarantees the
// level stays solvable while still reading as a real maze.

export const level01 = {
  id: 1,
  name: 'Le premier jardin',
  lives: 5,

  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },

  playerStart: { x: -8, z: -8, facing: 0 },

  tontonJiee: { x: 8, z: 8 },

  // Maze hedges. Each is a box on the ground plane.
  hedges: [
    { x: -5, z: -6, width: 8, depth: 0.8 },
    { x: -5, z: -2, width: 0.8, depth: 8 },
    { x: 0, z: 4, width: 10, depth: 0.8 },
    { x: 3, z: -3, width: 0.8, depth: 8 },
    { x: 6, z: 6, width: 0.8, depth: 4 },
    { x: -3, z: 8, width: 6, depth: 0.8 },
    { x: 7, z: -6, width: 6, depth: 0.8 },
    { x: -8, z: 3, width: 0.8, depth: 6 }
  ],

  // Purely decorative props. `solid: true` ones also register as small
  // collision/vision obstacles (a bench or pot is a fine hiding spot too).
  decorations: [
    { type: 'tree', x: -9, z: 5, scale: 1.1 },
    { type: 'tree', x: -1, z: -9, scale: 1 },
    { type: 'tree', x: 9, z: -1, scale: 1.2 },
    { type: 'tree', x: 1, z: 9, scale: 1 },
    { type: 'bush', x: -6, z: -8, scale: 0.8, solid: true },
    { type: 'bush', x: 3, z: 6, scale: 0.9, solid: true },
    { type: 'bush', x: -3, z: 1, scale: 0.8, solid: true },
    { type: 'statue', x: 0, z: -1, scale: 1, solid: true },
    { type: 'bench', x: -7, z: 6, scale: 1, solid: false },
    { type: 'pot', x: 5, z: -1, scale: 1, solid: true },
    { type: 'pot', x: -2, z: -8, scale: 1, solid: true },
    { type: 'fountain', x: 4.5, z: 4.5, scale: 1.1, solid: true }
  ],

  enemies: [
    {
      id: 'stress',
      name: 'STRESS',
      color: 0xb84a3e,
      speed: 1.9,
      chaseSpeed: 2.8,
      viewDistance: 5.5,
      viewAngleDeg: 70,
      waitAtPointMs: 500,
      patrol: [
        { x: -2, z: -2 },
        { x: 2.1, z: -2 },
        { x: 2.1, z: 3 },
        { x: -2, z: 3 }
      ]
    },
    {
      id: 'goumin',
      name: 'GOUMIN',
      color: 0x6a4a8a,
      speed: 1.7,
      chaseSpeed: 2.5,
      viewDistance: 5,
      viewAngleDeg: 75,
      waitAtPointMs: 600,
      patrol: [
        { x: 5, z: 3.5 },
        { x: 5, z: 1.5 },
        { x: 8.5, z: 1.5 },
        { x: 8.5, z: 3.5 }
      ]
    }
  ],

  positiveCharacters: [
    { id: 'dje-1', name: 'DJÊ', x: -6, z: -1, effect: 'life' }
  ]
};
