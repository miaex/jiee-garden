// A full sound-design pass will swap these procedural blips for real
// recorded/authored assets later. The important part for this first
// version is that every gameplay event already calls into a stable API
// (playHit, playVictory, ...), so dropping in real audio files later is
// a one-file change, not a hunt through the codebase.

class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    return this.ctx;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  _tone(freq, duration, type = 'sine', gainPeak = 0.12, delay = 0) {
    if (!this.enabled) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playFootstep() {
    this._tone(180, 0.06, 'triangle', 0.025);
  }

  // Low, throttled thump — called more frequently as danger increases,
  // so the player feels a guard's presence building before they're seen.
  playHeartbeat(intensity = 0.5) {
    const gain = 0.05 + intensity * 0.08;
    this._tone(70, 0.14, 'sine', gain);
    this._tone(55, 0.16, 'sine', gain * 0.7, 0.09);
  }

  playDetected() {
    this._tone(760, 0.18, 'sawtooth', 0.1);
  }

  playHit() {
    this._tone(140, 0.25, 'square', 0.15);
    this._tone(90, 0.3, 'square', 0.1, 0.05);
  }

  playLifeUp() {
    this._tone(520, 0.12, 'sine', 0.12);
    this._tone(780, 0.16, 'sine', 0.12, 0.1);
  }

  playVictory() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.3, 'sine', 0.12, i * 0.12));
  }

  playGameOver() {
    [400, 320, 240, 160].forEach((f, i) => this._tone(f, 0.35, 'sawtooth', 0.1, i * 0.15));
  }
}

export const audioManager = new AudioManager();
