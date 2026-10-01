import * as THREE from 'three';
import { PatrolAI, GuardState } from '../ai/PatrolAI.js';

const RADIUS = 0.3;

export class Enemy {
  constructor(scene, config, navGrid) {
    this.config = { radius: RADIUS, navGrid, ...config };
    this.ai = new PatrolAI(this.config);
    this.radius = RADIUS;

    this.root = new THREE.Group();
    this.root.position.set(this.ai.x, 0, this.ai.z);
    this._buildMesh(config.color);
    this._buildLabel(config.name);
    scene.add(this.root);

    this._walkT = 0;
    this._lastState = GuardState.PATROL;
    this.defeated = false;
    this._knockback = null;
  }

  _buildMesh(color) {
    const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 4, 8), skin);
    this.body.position.y = 0.38;
    this.body.castShadow = true;
    this.root.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), skin);
    this.head.position.y = 0.72;
    this.head.castShadow = true;
    this.root.add(this.head);

    const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
    this.eyeL = new THREE.Mesh(eyeGeo, dark);
    this.eyeL.position.set(-0.06, 0.74, 0.14);
    this.eyeR = new THREE.Mesh(eyeGeo, dark);
    this.eyeR.position.set(0.06, 0.74, 0.14);
    this.root.add(this.eyeL, this.eyeR);

    // Angled eyebrows — the single detail that reads as "hostile" from a
    // distance, without needing a full expressive face rig.
    const browGeo = new THREE.BoxGeometry(0.075, 0.02, 0.025);
    this.browL = new THREE.Mesh(browGeo, dark);
    this.browL.position.set(-0.065, 0.775, 0.15);
    this.browL.rotation.z = -0.4;
    this.browR = new THREE.Mesh(browGeo, dark);
    this.browR.position.set(0.065, 0.775, 0.15);
    this.browR.rotation.z = 0.4;
    this.root.add(this.browL, this.browR);

    const limbGeo = new THREE.CapsuleGeometry(0.05, 0.2, 3, 6);
    this.legL = new THREE.Mesh(limbGeo, skin);
    this.legL.position.set(-0.1, 0.18, 0);
    this.legR = new THREE.Mesh(limbGeo, skin);
    this.legR.position.set(0.1, 0.18, 0);
    this.root.add(this.legL, this.legR);

    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    this.contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.015;
    this.root.add(this.contactShadow);

    // Alert indicator (a small "!" style marker) — hidden until ALERT/CHASE.
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffce4a });
    this.alertMark = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), markMat);
    this.alertMark.position.y = 1.05;
    this.alertMark.visible = false;
    this.root.add(this.alertMark);

    // A small head spike/tuft — purely silhouette flavor so guards don't
    // read as identical blobs beyond their name tag and color.
    const tuftMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    this.tuft = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 6), tuftMat);
    this.tuft.position.set(0, 0.87, -0.02);
    this.tuft.rotation.x = -0.25;
    this.root.add(this.tuft);
  }

  _buildLabel(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 40px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,10,10,0.55)';
    roundRect(ctx, 8, 8, 240, 48, 16);
    ctx.fillStyle = '#f2ead9';
    ctx.fillText(name, 128, 33);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    this.label = new THREE.Sprite(material);
    this.label.scale.set(1.0, 0.25, 1);
    this.label.position.y = 1.05;
    this.label.renderOrder = 10;
    this.root.add(this.label);
  }

  update(dt, playerPos, collisionWorld) {
    if (this.defeated) {
      this._updateKnockback(dt);
      return 'DEFEATED';
    }

    const result = this.ai.update(dt, playerPos, collisionWorld);
    this.root.position.set(result.x, 0, result.z);
    this.root.rotation.y = result.facing;

    const moving = result.state !== GuardState.PATROL || true;
    this._walkT += dt * (result.state === GuardState.CHASE ? 8 : 4);
    const swing = Math.sin(this._walkT) * (result.state === GuardState.CHASE ? 0.7 : 0.4);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;

    const alerted = result.state === GuardState.ALERT;
    const chasing = result.state === GuardState.CHASE;
    this.alertMark.visible = alerted;
    if (this.alertMark.visible) {
      this.alertMark.rotation.y += dt * 4;
    }
    this.body.material.emissive = chasing
      ? new THREE.Color(0x330000)
      : new THREE.Color(0x000000);

    this._lastState = result.state;
    return result.state;
  }

  // Tonton Jiee's summon sweep: knocked off their feet, tumble through the
  // air toward (targetX, targetZ) — the spot Game.js already computed as
  // "just before whatever they'd crash into" — then land and stay down for
  // the rest of the level.
  knockBack(targetX, targetZ) {
    if (this.defeated) return;
    this.defeated = true;
    this._knockback = {
      fromX: this.root.position.x,
      fromZ: this.root.position.z,
      toX: targetX,
      toZ: targetZ,
      t: 0,
      duration: 0.38
    };
    this.alertMark.visible = false;
    this.label.visible = false;
  }

  _updateKnockback(dt) {
    const kb = this._knockback;
    if (!kb) return;
    kb.t = Math.min(1, kb.t + dt / kb.duration);
    const ease = 1 - (1 - kb.t) * (1 - kb.t);
    const x = kb.fromX + (kb.toX - kb.fromX) * ease;
    const z = kb.fromZ + (kb.toZ - kb.fromZ) * ease;
    const arc = Math.sin(kb.t * Math.PI) * 0.9;
    this.root.position.set(x, arc, z);
    this.root.rotation.z += dt * 20;

    if (kb.t >= 1) {
      this.root.position.y = 0;
      this.root.rotation.z = Math.PI / 2; // comes to rest on its side
      this._knockback = null;
    }
  }

  get position() {
    return this.root.position;
  }

  get facing() {
    return this.root.rotation.y;
  }

  get state() {
    return this.ai.state;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
