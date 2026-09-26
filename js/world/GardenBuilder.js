import * as THREE from 'three';

const HEDGE_HEIGHT = 1.4;

// Small procedural canvas textures give the ground/hedges a woven,
// speckled look instead of a flat color, without needing any external
// asset files — cheap to generate once and tiled via RepeatWrapping.
function makeNoiseTexture({ base, variants, size = 128, cell = 3 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      if (Math.random() < 0.55) {
        ctx.fillStyle = variants[Math.floor(Math.random() * variants.length)];
        ctx.globalAlpha = 0.35 + Math.random() * 0.35;
        ctx.fillRect(x, y, cell + 1, cell + 1);
      }
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBumpTexture({ size = 128, cell = 2, intensity = 0.5 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const v = Math.floor(128 + (Math.random() - 0.5) * 255 * intensity);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, cell + 1, cell + 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const grassTex = makeNoiseTexture({ base: '#4a7a3f', variants: ['#3f6b36', '#5c8f4a', '#436f3b'], cell: 2 });
grassTex.repeat.set(10, 10);
const grassBump = makeBumpTexture({ cell: 2, intensity: 0.35 });
grassBump.repeat.set(10, 10);

const pathTex = makeNoiseTexture({ base: '#c9b183', variants: ['#b89b6c', '#d8c299', '#a98a5c'], cell: 3 });
pathTex.repeat.set(3, 3);

const hedgeTex = makeNoiseTexture({ base: '#2f5230', variants: ['#264322', '#3c6a3b', '#22391f'], cell: 2 });
hedgeTex.repeat.set(2, 1);
const hedgeBump = makeBumpTexture({ cell: 3, intensity: 0.6 });
hedgeBump.repeat.set(2, 1);

// Reusable geometries/materials so many instances share GPU resources.
const materials = {
  ground: new THREE.MeshStandardMaterial({
    map: grassTex,
    bumpMap: grassBump,
    bumpScale: 0.04,
    color: 0xffffff,
    roughness: 0.95
  }),
  path: new THREE.MeshStandardMaterial({ map: pathTex, color: 0xffffff, roughness: 1 }),
  hedge: new THREE.MeshStandardMaterial({
    map: hedgeTex,
    bumpMap: hedgeBump,
    bumpScale: 0.08,
    color: 0xffffff,
    roughness: 0.85
  }),
  hedgeTop: new THREE.MeshStandardMaterial({
    map: hedgeTex,
    bumpMap: hedgeBump,
    bumpScale: 0.08,
    color: 0xcfe8cf,
    roughness: 0.85
  }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 }),
  foliage: new THREE.MeshStandardMaterial({ map: hedgeTex, color: 0xdfead0, roughness: 0.9 }),
  bush: new THREE.MeshStandardMaterial({ map: hedgeTex, color: 0xdfead0, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9a9689, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 0.85 }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xb0623f, roughness: 0.8 }),
  water: new THREE.MeshStandardMaterial({ color: 0x4a8fa8, roughness: 0.2, metalness: 0.1 })
};

/**
 * Builds ground, hedges and decoration meshes for a level, adding
 * collision/vision blockers to `collisionWorld` as it goes.
 */
export function buildGarden(scene, level, collisionWorld) {
  const { bounds } = level;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  collisionWorld.setBounds(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);

  // --- Ground ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width + 4, depth + 4, 1, 1), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, 0, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle path patches near start/goal for visual read of "walkable" areas.
  addPathPatch(scene, level.playerStart.x, level.playerStart.z, 4);
  addPathPatch(scene, level.tontonJiee.x, level.tontonJiee.z, 4);

  // --- Hedges (maze) ---
  const hedgeGroup = new THREE.Group();
  level.hedges.forEach((h) => {
    hedgeGroup.add(makeHedgeMesh(h.width, h.depth, h.x, h.z));
    collisionWorld.addBox(h.x, h.z, h.width, h.depth, { blocksMovement: true, blocksVision: true });
  });
  scene.add(hedgeGroup);

  // --- Boundary hedge (visual only near edges, kept low-cost) ---
  const border = [
    { x: centerX, z: bounds.minZ - 0.4, width: width + 2, depth: 0.8 },
    { x: centerX, z: bounds.maxZ + 0.4, width: width + 2, depth: 0.8 },
    { x: bounds.minX - 0.4, z: centerZ, width: 0.8, depth: depth + 2 },
    { x: bounds.maxX + 0.4, z: centerZ, width: 0.8, depth: depth + 2 }
  ];
  border.forEach((h) => hedgeGroup.add(makeHedgeMesh(h.width, h.depth, h.x, h.z)));

  // --- Decorations ---
  const decoGroup = new THREE.Group();
  level.decorations.forEach((d) => {
    const mesh = makeDecoration(d);
    if (mesh) decoGroup.add(mesh);
    if (d.solid) {
      const radius = 0.5 * (d.scale || 1);
      collisionWorld.addBox(d.x, d.z, radius * 2, radius * 2, {
        blocksMovement: true,
        blocksVision: d.type !== 'bench'
      });
    }
  });
  scene.add(decoGroup);

  const atmosphere = addAtmosphere(scene, bounds);

  return { ground, hedgeGroup, decoGroup, atmosphere };
}

function addAtmosphere(scene, bounds) {
  const count = 60;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    positions[i * 3 + 1] = 0.3 + Math.random() * 2.2;
    positions[i * 3 + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xf2ead9,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}

function addPathPatch(scene, x, z, size) {
  const patch = new THREE.Mesh(new THREE.CircleGeometry(size, 24), materials.path);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(x, 0.01, z);
  patch.receiveShadow = true;
  scene.add(patch);
}

function makeHedgeMesh(width, depth, x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, HEDGE_HEIGHT, depth), materials.hedge);
  body.position.set(x, HEDGE_HEIGHT / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, 0.18, depth * 0.98), materials.hedgeTop);
  top.position.set(x, HEDGE_HEIGHT + 0.09, z);
  top.castShadow = true;
  group.add(top);

  return group;
}

function makeDecoration(d) {
  const s = d.scale || 1;
  switch (d.type) {
    case 'tree': {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s, 8), materials.trunk);
      trunk.position.y = 0.6 * s;
      trunk.castShadow = true;
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 10, 10), materials.foliage);
      foliage.position.y = 1.6 * s;
      foliage.castShadow = true;
      g.add(trunk, foliage);
      g.position.set(d.x, 0, d.z);
      return g;
    }
    case 'bush': {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 10, 10), materials.bush);
      bush.position.set(d.x, 0.5 * s, d.z);
      bush.castShadow = true;
      bush.receiveShadow = true;
      return bush;
    }
    case 'statue': {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.45 * s, 0.25 * s, 8), materials.stone);
      base.position.y = 0.125 * s;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 1.1 * s, 8), materials.stone);
      body.position.y = 0.25 * s + 0.55 * s;
      g.add(base, body);
      g.position.set(d.x, 0, d.z);
      g.castShadow = true;
      return g;
    }
    case 'bench': {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.1 * s, 0.45 * s), materials.wood);
      seat.position.y = 0.4 * s;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 0.4 * s, 0.08 * s), materials.wood);
      back.position.set(0, 0.6 * s, -0.18 * s);
      g.add(seat, back);
      g.position.set(d.x, 0, d.z);
      g.castShadow = true;
      return g;
    }
    case 'pot': {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.24 * s, 0.4 * s, 10), materials.terracotta);
      pot.position.y = 0.2 * s;
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 8), materials.bush);
      plant.position.y = 0.5 * s;
      g.add(pot, plant);
      g.position.set(d.x, 0, d.z);
      g.castShadow = true;
      return g;
    }
    case 'fountain': {
      const g = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 0.75 * s, 0.35 * s, 16), materials.stone);
      rim.position.y = 0.175 * s;
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 0.05 * s, 16), materials.water);
      water.position.y = 0.35 * s;
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.6 * s, 8), materials.stone);
      center.position.y = 0.3 * s + 0.3 * s;
      g.add(rim, water, center);
      g.position.set(d.x, 0, d.z);
      g.castShadow = true;
      return g;
    }
    default:
      return null;
  }
}
