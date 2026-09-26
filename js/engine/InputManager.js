// Handles the two touch inputs the game needs: a virtual joystick for
// movement, and pinch-to-zoom for the camera. Mouse/wheel equivalents are
// included so the game is testable on desktop during development.

export class InputManager {
  constructor({ zoneEl, baseEl, knobEl, onZoomDelta }) {
    this.zoneEl = zoneEl;
    this.baseEl = baseEl;
    this.knobEl = knobEl;
    this.onZoomDelta = onZoomDelta || (() => {});

    this.moveVector = { x: 0, z: 0 };
    this._joystickTouchId = null;
    this._baseCenter = { x: 0, y: 0 };
    this._maxKnobDist = 44;

    this._pinch = { active: false, startDist: 0 };

    this._bindJoystick();
    this._bindPinchZoom();
    this._bindKeyboard(); // handy for desktop testing
  }

  _bindJoystick() {
    const start = (clientX, clientY, id) => {
      const rect = this.baseEl.getBoundingClientRect();
      this._baseCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this._joystickTouchId = id;
      this._updateKnob(clientX, clientY);
    };

    const move = (clientX, clientY) => this._updateKnob(clientX, clientY);

    const end = () => {
      this._joystickTouchId = null;
      this.moveVector = { x: 0, z: 0 };
      this.knobEl.style.transform = `translate(0px, 0px)`;
    };

    this.zoneEl.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches[0];
        start(t.clientX, t.clientY, t.identifier);
        e.preventDefault();
      },
      { passive: false }
    );

    this.zoneEl.addEventListener(
      'touchmove',
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this._joystickTouchId) move(t.clientX, t.clientY);
        }
        e.preventDefault();
      },
      { passive: false }
    );

    const touchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickTouchId) end();
      }
    };
    this.zoneEl.addEventListener('touchend', touchEnd);
    this.zoneEl.addEventListener('touchcancel', touchEnd);

    // Mouse fallback for desktop testing.
    let mouseDown = false;
    this.zoneEl.addEventListener('mousedown', (e) => {
      mouseDown = true;
      start(e.clientX, e.clientY, 'mouse');
    });
    window.addEventListener('mousemove', (e) => {
      if (mouseDown) move(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (mouseDown) end();
      mouseDown = false;
    });
  }

  _updateKnob(clientX, clientY) {
    let dx = clientX - this._baseCenter.x;
    let dy = clientY - this._baseCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this._maxKnobDist) {
      dx = (dx / dist) * this._maxKnobDist;
      dy = (dy / dist) * this._maxKnobDist;
    }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;

    const nx = dx / this._maxKnobDist;
    const ny = dy / this._maxKnobDist;
    const DEADZONE = 0.12; // ignore tiny thumb jitter near center so idle doesn't read as "drifting"
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) {
      this.moveVector = { x: 0, z: 0 };
      return;
    }
    // Rescale so input still reaches full magnitude just past the deadzone,
    // instead of every direction feeling slightly muted.
    const scale = (mag - DEADZONE) / (1 - DEADZONE) / mag;
    this.moveVector = { x: clampMag(nx * scale), z: clampMag(ny * scale) };
  }

  _bindPinchZoom() {
    const canvas = document.getElementById('game-canvas');

    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          this._pinch.active = true;
          this._pinch.startDist = touchDist(e.touches);
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          const dist = touchDist(e.touches);
          const delta = dist - this._pinch.startDist;
          this._pinch.startDist = dist;
          this.onZoomDelta(-delta * 0.02);
          e.preventDefault();
        }
      },
      { passive: false }
    );

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) this._pinch.active = false;
    });

    // Desktop wheel support.
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.onZoomDelta(e.deltaY * 0.01);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  _bindKeyboard() {
    this._keys = {};
    window.addEventListener('keydown', (e) => (this._keys[e.key.toLowerCase()] = true));
    window.addEventListener('keyup', (e) => (this._keys[e.key.toLowerCase()] = false));
  }

  getMoveVector() {
    // Merge keyboard (desktop testing) with joystick.
    const k = this._keys || {};
    let x = this.moveVector.x;
    let z = this.moveVector.z;
    if (k['arrowleft'] || k['q'] || k['a']) x -= 1;
    if (k['arrowright'] || k['d']) x += 1;
    if (k['arrowup'] || k['z'] || k['w']) z -= 1;
    if (k['arrowdown'] || k['s']) z += 1;
    return { x: clampMag(x), z: clampMag(z) };
  }
}

function clampMag(v) {
  return Math.max(-1, Math.min(1, v));
}

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
