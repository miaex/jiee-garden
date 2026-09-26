import * as THREE from 'three';

const SAFE_RADIUS = 0.9;

// Design intent: a believable human silhouette (normal legs, normal head
// size) with the exaggeration concentrated entirely in the upper body —
// traps, delts, arms — held in a permanent "double biceps" pose. That
// combination (realistic base + one absurd feature) is what reads as
// funny rather than just "a big blob".
export class TontonJiee {
  constructor(scene, x, z) {
    this.x = x;
    this.z = z;
    this.reached = false;
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this._buildMesh();
    scene.add(this.root);
    this._t = 0;
  }

  _buildMesh() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xdb9a68, roughness: 0.65 });
    const skinShine = new THREE.MeshStandardMaterial({ color: 0xe3a878, roughness: 0.4 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2f6b39, roughness: 0.8 });
    const shorts = new THREE.MeshStandardMaterial({ color: 0x274a2e, roughness: 0.85 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x2a1a10 });

    // --- Legs: normal human proportions, nothing exaggerated here ---
    const legGeo = new THREE.CapsuleGeometry(0.135, 0.55, 4, 8);
    this.legL = new THREE.Mesh(legGeo, shorts);
    this.legL.position.set(-0.15, 0.4, 0);
    this.legR = new THREE.Mesh(legGeo, shorts);
    this.legR.position.set(0.15, 0.4, 0);
    this.root.add(this.legL, this.legR);

    // --- Waist: deliberately narrow, so the shoulders read as huge by contrast ---
    this.waist = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 10), shorts);
    this.waist.position.y = 0.78;
    this.root.add(this.waist);

    // --- Torso: wide at the top (chest/lats), tapering down to the waist ---
    this.torso = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.22, 0.62, 12), shirt);
    this.torso.position.y = 1.14;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    const pecGeo = new THREE.SphereGeometry(0.19, 10, 10);
    this.pecL = new THREE.Mesh(pecGeo, shirt);
    this.pecL.position.set(-0.2, 1.32, 0.22);
    this.pecR = new THREE.Mesh(pecGeo, shirt);
    this.pecR.position.set(0.2, 1.32, 0.22);
    this.root.add(this.pecL, this.pecR);

    // --- Comic "six-pack" ridges peeking below the shirt — reads instantly
    // even at a distance/top-down angle, which a texture wouldn't. ---
    const abGeo = new THREE.CapsuleGeometry(0.045, 0.1, 2, 6);
    for (let i = 0; i < 3; i++) {
      const abL = new THREE.Mesh(abGeo, skin);
      abL.rotation.z = Math.PI / 2;
      abL.position.set(-0.09, 0.98 - i * 0.09, 0.28);
      const abR = new THREE.Mesh(abGeo, skin);
      abR.rotation.z = Math.PI / 2;
      abR.position.set(0.09, 0.98 - i * 0.09, 0.28);
      this.root.add(abL, abR);
    }

    // --- Trapezius: the exaggerated "no neck" mound between the shoulders ---
    this.traps = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), shirt);
    this.traps.scale.set(1.5, 0.55, 1.1);
    this.traps.position.y = 1.52;
    this.root.add(this.traps);

    // --- Neck: short and thick, half-swallowed by the traps ---
    this.neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.14, 8), skin);
    this.neck.position.y = 1.58;
    this.root.add(this.neck);

    // --- Head: kept at a NORMAL size — the mismatch with the huge torso is the joke ---
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), skin);
    this.head.position.y = 1.78;
    this.head.castShadow = true;
    this.root.add(this.head);

    const browGeo = new THREE.BoxGeometry(0.09, 0.025, 0.03);
    this.browL = new THREE.Mesh(browGeo, dark);
    this.browL.position.set(-0.07, 1.82, 0.165);
    this.browL.rotation.z = 0.15;
    this.browR = new THREE.Mesh(browGeo, dark);
    this.browR.position.set(0.07, 1.82, 0.165);
    this.browR.rotation.z = -0.15;
    this.root.add(this.browL, this.browR);

    this.smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 12, Math.PI), dark);
    this.smile.position.set(0, 1.74, 0.175);
    this.smile.rotation.x = Math.PI;
    this.root.add(this.smile);

    // --- Headband: a small comic-hero touch, and it also visually
    // separates the (normal-sized) head from the huge traps beneath it. ---
    const headbandMat = new THREE.MeshStandardMaterial({ color: 0xc9432f, roughness: 0.7 });
    this.headband = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.03, 8, 16), headbandMat);
    this.headband.rotation.x = Math.PI / 2;
    this.headband.position.y = 1.8;
    this.root.add(this.headband);

    // --- Shoulders (deltoids): oversized spheres, the widest point of the body ---
    const deltGeo = new THREE.SphereGeometry(0.24, 12, 12);
    this.deltL = new THREE.Mesh(deltGeo, shirt);
    this.deltL.position.set(-0.56, 1.46, 0);
    this.deltR = new THREE.Mesh(deltGeo, shirt);
    this.deltR.position.set(0.56, 1.46, 0);
    this.root.add(this.deltL, this.deltR);

    // --- Arms: built as groups so they can hold a permanent "double biceps" pose ---
    this.armL = this._buildArm(skinShine, -1);
    this.armR = this._buildArm(skinShine, 1);
    this.armL.position.set(-0.56, 1.46, 0);
    this.armR.position.set(0.56, 1.46, 0);
    this.root.add(this.armL, this.armR);

    // Safe-zone marker on the ground.
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xe7b559, transparent: true, opacity: 0.18 });
    this.zone = new THREE.Mesh(new THREE.CircleGeometry(SAFE_RADIUS, 24), zoneMat);
    this.zone.rotation.x = -Math.PI / 2;
    this.zone.position.y = 0.02;
    this.root.add(this.zone);
  }

  // side: -1 for left, +1 for right. Returns a pivot group so the whole
  // arm can be posed/animated from the shoulder.
  _buildArm(mat, side) {
    const pivot = new THREE.Group();

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.26, 4, 10), mat);
    upperArm.position.set(side * 0.16, -0.06, 0.05);
    upperArm.rotation.z = side * 1.15; // flare outward, elbow up — biceps pose
    upperArm.castShadow = true;
    pivot.add(upperArm);

    // The bicep "peak" — an extra bump so the flex silhouette reads clearly.
    const bicep = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 10), mat);
    bicep.position.set(side * 0.27, 0.08, 0.09);
    pivot.add(bicep);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10), mat);
    forearm.position.set(side * 0.36, 0.28, -0.04);
    forearm.rotation.z = side * 2.7;
    forearm.castShadow = true;
    pivot.add(forearm);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat);
    fist.position.set(side * 0.34, 0.44, -0.1);
    pivot.add(fist);

    return pivot;
  }

  update(dt) {
    this._t += dt;
    // Idle flex — small welcoming "breathing" bounce, arms stay in the flex pose.
    const bump = Math.sin(this._t * 1.6) * 0.015;
    this.armL.scale.setScalar(1 + bump);
    this.armR.scale.setScalar(1 + bump);
    this.head.position.y = 1.78 + Math.sin(this._t * 1.2) * 0.008;
  }

  checkReached(playerPos) {
    if (this.reached) return false;
    const dist = Math.hypot(playerPos.x - this.x, playerPos.z - this.z);
    if (dist < SAFE_RADIUS) {
      this.reached = true;
      return true;
    }
    return false;
  }

  playVictoryAnimation() {
    // Both arms punch upward in triumph.
    this.armL.rotation.z = -0.6;
    this.armR.rotation.z = 0.6;
  }
}
