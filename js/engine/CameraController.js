import * as THREE from 'three';

const MIN_DIST = 4.5;
const MAX_DIST = 38;
const DEFAULT_DIST = 9;
const PITCH_DEG = 55; // angled top-down, not a flat orthographic look
const FOLLOW_LERP = 6;
const ZOOM_LERP = 8;
const MIN_SAFE_DIST = 5; // never let occlusion push the camera closer than this
const OCCLUSION_IGNORE_DIST = 2.2; // ignore hedges this close to the player — see note below
const BASE_FOV = 45;

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.distance = DEFAULT_DIST;
    this.targetDistance = DEFAULT_DIST;
    this.lookTarget = new THREE.Vector3();
    this.currentLookTarget = new THREE.Vector3();
    this._pitch = (PITCH_DEG * Math.PI) / 180;
    this._raycaster = new THREE.Raycaster();
    this._occluders = [];
    this._targetFov = BASE_FOV;
    this.panOffset = new THREE.Vector3(0, 0, 0);
  }

  // Meshes/groups the camera should not clip through (hedges, solid
  // decorations). Passed once per level load.
  setOccluders(objects) {
    this._occluders = objects;
  }

  addZoom(delta) {
    this.targetDistance = clamp(this.targetDistance + delta, MIN_DIST, MAX_DIST);
  }

  setZoomButtonsStep(sign) {
    this.addZoom(sign * 3.2);
  }

  // 0..1 danger level — subtly widens the FOV for a mild "adrenaline" push
  // when a guard is alert/chasing, without being a gimmicky camera shake.
  setDanger(value) {
    this._targetFov = BASE_FOV + clamp(value, 0, 1) * 6;
  }

  // Drag-to-scout: shifts what the camera looks at, away from the player,
  // so the garden can be surveyed before committing to a path. Scaled by
  // current zoom so the drag feels consistent whether zoomed in or out.
  pan(dxScreen, dyScreen) {
    const scale = this.distance * 0.0022;
    this.panOffset.x += dxScreen * scale;
    this.panOffset.z += dyScreen * scale;
  }

  // Called every frame with whether the player is actively steering —
  // as soon as they are, the view smoothly recenters on them rather than
  // lingering wherever they last panned to.
  follow(targetPos, dt, playerIsMoving = false) {
    if (playerIsMoving && this.panOffset.lengthSq() > 0.0001) {
      this.panOffset.multiplyScalar(Math.max(0, 1 - Math.min(1, 6 * dt)));
    }

    this.lookTarget.set(targetPos.x + this.panOffset.x, 0.6, targetPos.z + this.panOffset.z);
    const followT = Math.min(1, FOLLOW_LERP * dt);
    this.currentLookTarget.lerp(this.lookTarget, followT);

    this.distance += (this.targetDistance - this.distance) * Math.min(1, ZOOM_LERP * dt);

    const horizontal = this.distance * Math.cos(this._pitch);
    const vertical = this.distance * Math.sin(this._pitch);

    // Camera sits south of the target, angled down — gives depth/parallax
    // instead of a flat orthographic top-down look.
    let camPos = new THREE.Vector3(
      this.currentLookTarget.x,
      vertical,
      this.currentLookTarget.z + horizontal
    );

    camPos = this._clampAgainstOccluders(camPos);

    this.camera.position.copy(camPos);
    this.camera.lookAt(this.currentLookTarget);

    if (Math.abs(this.camera.fov - this._targetFov) > 0.02) {
      this.camera.fov += (this._targetFov - this.camera.fov) * Math.min(1, 5 * dt);
      this.camera.updateProjectionMatrix();
    }
  }

  // If a hedge/decoration sits between the look target and the desired
  // camera position, pull the camera in front of it instead of letting it
  // clip through. Cheap: one ray per frame against the level's static
  // occluder groups.
  //
  // Bug fixed here: a hedge the PLAYER is standing right next to used to
  // trigger this too. At that short range the ray hasn't climbed to its
  // normal elevated angle yet, so clamping along it put the camera at
  // near-ground level, a few centimeters from a hedge face — the screen
  // filled entirely with one blown-up texture. Ignoring anything within
  // OCCLUSION_IGNORE_DIST of the player fixes it: occlusion now only
  // reacts to something genuinely between the player and the camera
  // further back, not a wall the player is simply adjacent to.
  _clampAgainstOccluders(desiredPos) {
    if (!this._occluders.length) return desiredPos;

    const offset = desiredPos.clone().sub(this.currentLookTarget);
    const fullDist = offset.length();
    if (fullDist < 0.001) return desiredPos;
    const dir = offset.clone().normalize();

    this._raycaster.set(this.currentLookTarget, dir);
    this._raycaster.far = fullDist;
    this._raycaster.near = Math.min(OCCLUSION_IGNORE_DIST, fullDist * 0.5);

    const hits = this._raycaster.intersectObjects(this._occluders, true);
    if (hits.length && hits[0].distance < fullDist - 0.4) {
      const clamped = Math.max(MIN_SAFE_DIST, hits[0].distance - 0.3);
      return this.currentLookTarget.clone().add(dir.multiplyScalar(clamped));
    }
    return desiredPos;
  }

  snapTo(targetPos) {
    this.currentLookTarget.set(targetPos.x, 0.6, targetPos.z);
    this.follow(targetPos, 1);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
