// A full sound-design pass will swap these procedural blips for real
// recorded/authored assets later. The important part for this first
// version is that every gameplay event already calls into a stable API
// (playHit, playVictory, ...), so dropping in real audio files later is
// a one-file change, not a hunt through the codebase.

const MUSIC_VOLUME = 0.78;

class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.musicEl = null;
    this.musicStarted = false;
  }

  // Mobile browsers block audio until a real user gesture — so this is
  // only ever called from inside a click handler (the onboarding/"Jouer"
  // buttons), never on page load. Idempotent: whichever of those fires
  // first wins, the other call is a no-op.
  startMusic(src) {
    if (this.musicStarted) return;
    this.musicStarted = true;
    try {
      this.musicEl = new Audio(src);
      this.musicEl.loop = true;
      this.musicEl.preload = 'auto';
      this.musicEl.volume = this.enabled ? MUSIC_VOLUME : 0;
      this.musicEl.play().catch(() => {
        // Autoplay still refused for some reason — it'll start on the
        // next interaction instead since musicStarted stays true and we
        // don't retry-loop here; not worth surfacing to the player.
      });
    } catch (e) {
      console.warn('Background music failed to start:', e);
    }
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
    if (this.musicEl) this.musicEl.volume = enabled ? MUSIC_VOLUME : 0;
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

  playDash() {
    this._tone(300, 0.1, 'sawtooth', 0.08);
    this._tone(500, 0.08, 'sawtooth', 0.06, 0.04);
  }

  playSummonReady() {
    this._tone(440, 0.12, 'sine', 0.1);
    this._tone(660, 0.14, 'sine', 0.1, 0.1);
  }

  playSweep() {
    this._tone(200, 0.08, 'sawtooth', 0.12);
    this._tone(700, 0.15, 'sine', 0.08, 0.03);
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
