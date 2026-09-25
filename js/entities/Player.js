import * as THREE from 'three';

const MAX_SPEED = 3.4;
const ACCEL = 14;
const DECEL = 18;
const TURN_SPEED = 10;
const RADIUS = 0.32;
const INVINCIBLE_MS = 1200;

export class Player {
  constructor(scene, startX, startZ) {
    this.radius = RADIUS;
    this.velocity = new THREE.Vector2(0, 0);
    this.facing = 0; // radians, 0 = +Z
    this.speed = 0;
    this.invincibleUntil = 0;
    this.alive = true;

    this.root = new THREE.Group();
    this.root.position.set(startX, 0, startZ);
    this._buildMesh();
    scene.add(this.root);

    this._walkT = 0;
  }

  _buildMesh() {
    const fur = new THREE.MeshStandardMaterial({ color: 0xa9762f, roughness: 0.9 });
    const furLight = new THREE.MeshStandardMaterial({ color: 0xd9ab5f, roughness: 0.9 });
    const nose = new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.6 });

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.22, 4, 8), fur);
    this.body.position.y = 0.42;
    this.body.castShadow = true;
    this.root.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), fur);
    this.head.position.y = 0.78;
    this.head.castShadow = true;
    this.root.add(this.head);

    const earGeo = new THREE.SphereGeometry(0.07, 8, 8);
    this.earL = new THREE.Mesh(earGeo, fur);
    this.earL.position.set(-0.14, 0.94, 0.02);
    this.earR = new THREE.Mesh(earGeo, fur);
    this.earR.position.set(0.14, 0.94, 0.02);
    this.root.add(this.earL, this.earR);

    this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), furLight);
    this.muzzle.position.set(0, 0.75, 0.17);
    this.root.add(this.muzzle);

    this.noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), nose);
    this.noseMesh.position.set(0, 0.77, 0.24);
    this.root.add(this.noseMesh);

    const limbGeo = new THREE.CapsuleGeometry(0.055, 0.22, 3, 6);
    this.armL = new THREE.Mesh(limbGeo, fur);
    this.armL.position.set(-0.26, 0.5, 0);
    this.armR = new THREE.Mesh(limbGeo, fur);
    this.armR.position.set(0.26, 0.5, 0);
    this.legL = new THREE.Mesh(limbGeo, fur);
    this.legL.position.set(-0.11, 0.2, 0);
    this.legR = new THREE.Mesh(limbGeo, fur);
    this.legR.position.set(0.11, 0.2, 0);
    [this.armL, this.armR, this.legL, this.legR].forEach((m) => {
      m.castShadow = true;
      this.root.add(m);
    });

    // Soft contact shadow blob — a cheap way to ground the character
    // visually even where the directional-light shadow map is coarse.
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
    this.contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.015;
    this.root.add(this.contactShadow);
  }

  get position() {
    return this.root.position;
  }

  /**
   * @param {number} dt seconds
   * @param {{x:number,z:number}} inputVec normalized-ish joystick vector (x right, z forward as -1..1)
   * @param {import('../world/Collision.js').CollisionWorld} collisionWorld
   */
  update(dt, inputVec, collisionWorld) {
    const hasInput = inputVec.x !== 0 || inputVec.z !== 0;
    const targetVX = inputVec.x * MAX_SPEED;
    const targetVZ = inputVec.z * MAX_SPEED;

    const rate = hasInput ? ACCEL : DECEL;
    this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, rate * dt);
    this.velocity.y += (targetVZ - this.velocity.y) * Math.min(1, rate * dt);

    this.speed = this.velocity.length();

    if (this.speed > 0.05) {
      const targetFacing = Math.atan2(this.velocity.x, this.velocity.y);
      this.facing = lerpAngle(this.facing, targetFacing, Math.min(1, TURN_SPEED * dt));
    }

    let nx = this.root.position.x + this.velocity.x * dt;
    let nz = this.root.position.z + this.velocity.y * dt;

    const resolved = collisionWorld.resolveCircle(nx, nz, this.radius);
    this.root.position.x = resolved.x;
    this.root.position.z = resolved.z;
    this.root.rotation.y = this.facing;

    this._animate(dt);
  }

  _animate(dt) {
    const moving = this.speed > 0.15;
    if (moving) {
      this._walkT += dt * (3 + this.speed * 1.6);
    } else {
      this._walkT += dt * 1.2; // gentle idle sway
    }
    const swing = moving ? Math.sin(this._walkT) * 0.55 : Math.sin(this._walkT) * 0.06;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;

    const bob = moving ? Math.abs(Math.sin(this._walkT * 2)) * 0.05 : Math.sin(this._walkT) * 0.015;
    this.body.position.y = 0.42 + bob;
    this.head.position.y = 0.78 + bob;

    // Invincibility flicker feedback.
    const flashing = performance.now() < this.invincibleUntil;
    this.root.visible = !flashing || Math.floor(performance.now() / 90) % 2 === 0;
  }

  hit() {
    if (performance.now() < this.invincibleUntil) return false;
    this.invincibleUntil = performance.now() + INVINCIBLE_MS;
    return true;
  }

  isInvincible() {
    return performance.now() < this.invincibleUntil;
  }

  playVictory() {
    // Simple celebratory arm raise, called once on reaching Tonton Jiee.
    this.armL.rotation.x = -2.4;
    this.armR.rotation.x = -2.4;
  }

  reset(x, z) {
    this.root.position.set(x, 0, z);
    this.velocity.set(0, 0);
    this.facing = 0;
    this.invincibleUntil = 0;
    this.root.visible = true;
  }
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
