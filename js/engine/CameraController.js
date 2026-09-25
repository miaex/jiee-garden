import * as THREE from 'three';

const MIN_DIST = 4.5;
const MAX_DIST = 38;
const DEFAULT_DIST = 9;
const PITCH_DEG = 55; // angled top-down, not a flat orthographic look
const FOLLOW_LERP = 6;
const ZOOM_LERP = 8;

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.distance = DEFAULT_DIST;
    this.targetDistance = DEFAULT_DIST;
    this.lookTarget = new THREE.Vector3();
    this.currentLookTarget = new THREE.Vector3();
    this._pitch = (PITCH_DEG * Math.PI) / 180;
  }

  addZoom(delta) {
    this.targetDistance = clamp(this.targetDistance + delta, MIN_DIST, MAX_DIST);
  }

  setZoomButtonsStep(sign) {
    this.addZoom(sign * 3.2);
  }

  follow(targetPos, dt) {
    this.lookTarget.set(targetPos.x, 0.6, targetPos.z);
    const followT = Math.min(1, FOLLOW_LERP * dt);
    this.currentLookTarget.lerp(this.lookTarget, followT);

    this.distance += (this.targetDistance - this.distance) * Math.min(1, ZOOM_LERP * dt);

    const horizontal = this.distance * Math.cos(this._pitch);
    const vertical = this.distance * Math.sin(this._pitch);

    // Camera sits south of the target, angled down — gives depth/parallax
    // instead of a flat orthographic top-down look.
    const camPos = new THREE.Vector3(
      this.currentLookTarget.x,
      vertical,
      this.currentLookTarget.z + horizontal
    );

    this.camera.position.copy(camPos);
    this.camera.lookAt(this.currentLookTarget);
  }

  snapTo(targetPos) {
    this.currentLookTarget.set(targetPos.x, 0.6, targetPos.z);
    this.follow(targetPos, 1);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
