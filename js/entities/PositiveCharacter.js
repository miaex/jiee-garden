import * as THREE from 'three';

const PICKUP_RADIUS = 0.55;

// Extensible by design: today only 'life' exists, but the effect is just a
// string key so future bonuses (speed, shield, invisibility...) plug in by
// adding a case wherever effects are applied (see Game.js `_applyPositiveEffect`).
export class PositiveCharacter {
  constructor(scene, config) {
    this.config = config;
    this.collected = false;
    this.root = new THREE.Group();
    this.root.position.set(config.x, 0, config.z);
    this._buildMesh();
    scene.add(this.root);
    this._t = Math.random() * Math.PI * 2;
  }

  _buildMesh() {
    const glow = new THREE.MeshStandardMaterial({
      color: 0xe7b559,
      emissive: 0x7a4f12,
      roughness: 0.5
    });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), glow);
    this.body.position.y = 0.5;
    this.body.castShadow = true;
    this.root.add(this.body);

    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 0.54, 0.2);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 0.54, 0.2);
    this.root.add(eyeL, eyeR);

    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10, Math.PI), eyeMat);
    smile.position.set(0, 0.46, 0.19);
    smile.rotation.x = Math.PI;
    this.root.add(smile);

    const heart = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xd1473a, emissive: 0x440000 })
    );
    heart.position.y = 0.82;
    this.root.add(heart);
    this.heart = heart;
  }

  update(dt) {
    if (this.collected) return;
    this._t += dt;
    this.root.position.y = Math.sin(this._t * 2) * 0.08 + 0.05;
    this.root.rotation.y += dt * 1.2;
  }

  tryCollect(playerPos) {
    if (this.collected) return false;
    const dist = Math.hypot(playerPos.x - this.root.position.x, playerPos.z - this.config.z);
    if (dist < PICKUP_RADIUS) {
      this.collected = true;
      this.root.visible = false;
      return true;
    }
    return false;
  }
}
