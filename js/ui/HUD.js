import { i18n } from '../i18n/i18n.js';

export class HUD {
  constructor() {
    this.livesEl = document.getElementById('lives');
    this.levelLabelEl = document.getElementById('level-label');
    this.statusEl = document.getElementById('status-hint');
    this._statusTimeout = null;
    this.tensionEl = document.getElementById('tension-vignette');
    this.hitFlashEl = document.getElementById('hit-flash');
    this.buffEl = document.getElementById('buff-indicator');
    this._buffTimeout = null;
    this.fpsEl = document.getElementById('fps-counter');

    this.screens = {
      loading: document.getElementById('screen-loading'),
      onboarding: document.getElementById('screen-onboarding'),
      pause: document.getElementById('screen-pause'),
      victory: document.getElementById('screen-victory'),
      gameover: document.getElementById('screen-gameover'),
      menu: document.getElementById('screen-menu')
    };

    this.loadingBar = document.getElementById('loading-bar');
    this.loadingText = document.getElementById('loading-text');
    this.menuGreetingEl = document.getElementById('menu-greeting');
    this.menuStatsEl = document.getElementById('menu-stats');
    this.victoryCandiesEl = document.getElementById('victory-candies');
    this.victoryMessageEl = document.getElementById('victory-message');
  }

  setLoadingProgress(fraction, text) {
    this.loadingBar.style.width = `${Math.round(fraction * 100)}%`;
    if (text) this.loadingText.textContent = text;
  }

  setLevelLabel(n) {
    this.levelLabelEl.textContent = i18n.t('level.label', { n });
  }

  renderLives(current, total) {
    this.livesEl.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const span = document.createElement('span');
      span.className = 'heart' + (i >= current ? ' lost' : '');
      span.textContent = i >= current ? '🖤' : '❤️';
      this.livesEl.appendChild(span);
    }
  }

  pulseLastHeart(current) {
    const hearts = this.livesEl.querySelectorAll('.heart');
    const heart = hearts[current]; // the one that just changed
    if (heart) {
      heart.classList.add('pulse');
      setTimeout(() => heart.classList.remove('pulse'), 300);
    }
  }

  showStatus(key, durationMs = 900) {
    this.statusEl.textContent = i18n.t(key);
    this.statusEl.classList.add('show');
    clearTimeout(this._statusTimeout);
    if (durationMs > 0) {
      this._statusTimeout = setTimeout(() => this.statusEl.classList.remove('show'), durationMs);
    }
  }

  hideStatus() {
    this.statusEl.classList.remove('show');
  }

  // value 0..1 — how close/exposed the player currently is to a guard.
  setTension(value) {
    this.tensionEl.style.opacity = Math.max(0, Math.min(1, value)).toFixed(2);
  }

  flashHit() {
    this.hitFlashEl.classList.remove('flash');
    // Force reflow so the animation restarts even on rapid repeated hits.
    void this.hitFlashEl.offsetWidth;
    this.hitFlashEl.classList.add('flash');
  }

  // Debug-only perf readout, meant for real-device playtesting — not part
  // of the normal player-facing HUD. Call setFPSVisible(true) to show it.
  setFPSVisible(visible) {
    this.fpsEl.classList.toggle('visible', visible);
  }

  updateFPS(fps, drawCalls) {
    this.fpsEl.textContent = drawCalls != null ? `${fps} fps · ${drawCalls} draws` : `${fps} fps`;
    this.fpsEl.classList.toggle('warn', fps < 50 && fps >= 30);
    this.fpsEl.classList.toggle('bad', fps < 30);
  }

  showBuff(type, durationMs) {
    const icon = type === 'speed' ? '⚡' : type === 'shield' ? '🛡️' : '✨';
    const label = type === 'speed' ? i18n.t('buff.speed') : type === 'shield' ? i18n.t('buff.shield') : '';
    this.buffEl.textContent = `${icon} ${label}`;
    this.buffEl.classList.add('show');
    clearTimeout(this._buffTimeout);
    this._buffTimeout = setTimeout(() => this.buffEl.classList.remove('show'), durationMs);
  }

  showScreen(name) {
    Object.entries(this.screens).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== name);
    });
    i18n.applyToDOM();
  }

  hideAllScreens() {
    Object.values(this.screens).forEach((el) => el.classList.add('hidden'));
  }

  setMenuGreeting(name) {
    if (name && name.trim()) {
      this.menuGreetingEl.textContent = i18n.t('menu.greeting', { name: name.trim() });
      this.menuGreetingEl.style.display = '';
    } else {
      this.menuGreetingEl.style.display = 'none';
    }
  }

  setMenuStats(levelReached, candyCount) {
    this.menuStatsEl.innerHTML = '';
    const levelSpan = document.createElement('span');
    levelSpan.textContent = i18n.t('menu.level', { n: levelReached });
    const candySpan = document.createElement('span');
    candySpan.textContent = '🍬 ' + i18n.t('menu.candies', { count: candyCount });
    this.menuStatsEl.appendChild(levelSpan);
    this.menuStatsEl.appendChild(candySpan);
  }

  setVictoryReward(candyRow, message) {
    this.victoryCandiesEl.textContent = candyRow;
    this.victoryMessageEl.textContent = message;
  }
}
