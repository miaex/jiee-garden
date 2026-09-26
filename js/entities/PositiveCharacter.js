import * as THREE from 'three';

const PICKUP_RADIUS = 0.55;

const EFFECT_STYLE = {
  life: { color: 0xe7b559, emissive: 0x7a4f12, accent: 0xd1473a },
  speed: { color: 0x4ab0e0, emissive: 0x0f4a6b, accent: 0xdff3ff },
  shield: { color: 0x5fd18a, emissive: 0x0f5b34, accent: 0xe8fff2 }
};

// Extensible by design: the effect is just a string key, so adding a new
// power-up later is "add a case in Game.js `_applyPositiveEffect`" plus an
// entry here for its look — nothing else in the codebase needs to change.
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
    const style = EFFECT_STYLE[this.config.effect] || EFFECT_STYLE.life;
    const glow = new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.emissive,
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

    // A small icon above the head so the effect is readable before you
    // even reach it: a heart, a lightning streak, or a shield hex.
    const accentMat = new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.emissive, roughness: 0.4 });
    if (this.config.effect === 'speed') {
      const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), accentMat);
      bolt.position.y = 0.82;
      bolt.rotation.z = Math.PI;
      this.root.add(bolt);
    } else if (this.config.effect === 'shield') {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 6), accentMat);
      shield.position.y = 0.82;
      shield.rotation.x = Math.PI / 2;
      this.root.add(shield);
    } else {
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), accentMat);
      heart.position.y = 0.82;
      this.root.add(heart);
    }
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
