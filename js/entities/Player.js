import * as THREE from 'three';
import { audioManager } from '../engine/AudioManager.js';

const MAX_SPEED = 3.7;
const ACCEL = 17;
const DECEL = 20;
const TURN_SPEED = 13;
const RADIUS = 0.32;
const INVINCIBLE_MS = 1200;

const DASH_SPEED = 8.5;
const DASH_DURATION_MS = 200;
const DASH_COOLDOWN_MS = 1400;
const DASH_INVINCIBLE_MS = 260;

export class Player {
  constructor(scene, startX, startZ) {
    this.radius = RADIUS;
    this.velocity = new THREE.Vector2(0, 0);
    this.facing = 0; // radians, 0 = +Z
    this.speed = 0;
    this.invincibleUntil = 0;
    this.alive = true;
    this.speedMultiplier = 1;
    this.speedBoostUntil = 0;
    this.shielded = false;
    this.dashUntil = 0;
    this.dashCooldownUntil = 0;
    this.dashDir = { x: 0, z: 1 };

    this.root = new THREE.Group();
    this.root.position.set(startX, 0, startZ);
    this._buildMesh();
    scene.add(this.root);

    this._walkT = 0;
    this._stepCooldown = 0;
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

    // A small bow tie — the one accessory detail that reads clearly at
    // the game's usual camera distance and reinforces the "toy" read.
    const bowMat = new THREE.MeshStandardMaterial({ color: 0xb0392f, roughness: 0.6 });
    const bowL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), bowMat);
    bowL.rotation.z = Math.PI / 2;
    bowL.position.set(-0.045, 0.58, 0.19);
    const bowR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), bowMat);
    bowR.rotation.z = -Math.PI / 2;
    bowR.position.set(0.045, 0.58, 0.19);
    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), bowMat);
    bowKnot.position.set(0, 0.58, 0.19);
    this.root.add(bowL, bowR, bowKnot);

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
    if (performance.now() > this.speedBoostUntil) this.speedMultiplier = 1;

    // Remember the last real movement direction so a dash triggered while
    // standing still still goes somewhere sensible (facing direction)
    // rather than nowhere.
    if (hasInput) {
      const mag = Math.hypot(inputVec.x, inputVec.z) || 1;
      this.dashDir = { x: inputVec.x / mag, z: inputVec.z / mag };
    }

    const dashing = performance.now() < this.dashUntil;

    if (dashing) {
      this.velocity.x = this.dashDir.x * DASH_SPEED;
      this.velocity.y = this.dashDir.z * DASH_SPEED;
    } else {
      const targetVX = inputVec.x * MAX_SPEED * this.speedMultiplier;
      const targetVZ = inputVec.z * MAX_SPEED * this.speedMultiplier;
      const rate = hasInput ? ACCEL : DECEL;
      this.velocity.x += (targetVX - this.velocity.x) * Math.min(1, rate * dt);
      this.velocity.y += (targetVZ - this.velocity.y) * Math.min(1, rate * dt);
    }

    this.speed = this.velocity.length();

    if (this.speed > 0.05) {
      const targetFacing = Math.atan2(this.velocity.x, this.velocity.y);
      this.facing = lerpAngle(this.facing, targetFacing, Math.min(1, TURN_SPEED * dt));
    }

    // Resolved one axis at a time (not as a single diagonal step) so
    // pushing diagonally into a wall still slides at full speed along
    // whichever axis is actually open, instead of feeling like it drags.
    const oldX = this.root.position.x;
    const oldZ = this.root.position.z;

    let nx = oldX + this.velocity.x * dt;
    nx = collisionWorld.resolveCircle(nx, oldZ, this.radius).x;

    let nz = oldZ + this.velocity.y * dt;
    nz = collisionWorld.resolveCircle(nx, nz, this.radius).z;

    this.root.position.x = nx;
    this.root.position.z = nz;
    this.root.rotation.y = this.facing;

    this._animate(dt);
  }

  _animate(dt) {
    const moving = this.speed > 0.15;
    if (moving) {
      this._walkT += dt * (3 + this.speed * 1.6);
      this._stepCooldown -= dt;
      if (this._stepCooldown <= 0) {
        audioManager.playFootstep();
        this._stepCooldown = Math.max(0.16, 0.42 - this.speed * 0.06);
      }
    } else {
      this._walkT += dt * 1.2; // gentle idle sway
      this._stepCooldown = 0;
    }
    const swing = moving ? Math.sin(this._walkT) * 0.55 : Math.sin(this._walkT) * 0.06;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;

    const bob = moving ? Math.abs(Math.sin(this._walkT * 2)) * 0.05 : Math.sin(this._walkT) * 0.015;
    this.body.position.y = 0.42 + bob;
    this.head.position.y = 0.78 + bob;

    // Forward lean during a dash — the one cheap touch that sells "quick
    // acrobatic dodge" rather than just "moving faster".
    const dashing = performance.now() < this.dashUntil;
    const targetLean = dashing ? 0.5 : 0;
    this.root.rotation.x += (targetLean - this.root.rotation.x) * Math.min(1, 14 * dt);

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

  // Power-up effects (from positive characters) — kept as simple timed
  // state on the player so Game.js doesn't need to know how each one is
  // implemented, just that it happened.
  applySpeedBoost(durationMs, multiplier = 1.6) {
    this.speedMultiplier = multiplier;
    this.speedBoostUntil = performance.now() + durationMs;
  }

  applyShield(durationMs) {
    this.invincibleUntil = Math.max(this.invincibleUntil, performance.now() + durationMs);
  }

  // A short, fast burst in the last-moved (or currently faced) direction,
  // with brief invincibility — the "acrobatic" dodge move: juke out of a
  // guard's cone, or slip past one at the last second.
  tryDash() {
    const now = performance.now();
    if (now < this.dashCooldownUntil) return false;
    this.dashUntil = now + DASH_DURATION_MS;
    this.dashCooldownUntil = now + DASH_COOLDOWN_MS;
    this.invincibleUntil = Math.max(this.invincibleUntil, now + DASH_INVINCIBLE_MS);
    return true;
  }

  dashCooldownFraction() {
    const now = performance.now();
    if (now >= this.dashCooldownUntil) return 0;
    const remaining = this.dashCooldownUntil - now;
    return Math.min(1, remaining / DASH_COOLDOWN_MS);
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
