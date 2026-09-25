import { i18n } from '../i18n/i18n.js';

export class HUD {
  constructor() {
    this.livesEl = document.getElementById('lives');
    this.levelLabelEl = document.getElementById('level-label');
    this.statusEl = document.getElementById('status-hint');
    this._statusTimeout = null;

    this.screens = {
      loading: document.getElementById('screen-loading'),
      pause: document.getElementById('screen-pause'),
      victory: document.getElementById('screen-victory'),
      gameover: document.getElementById('screen-gameover'),
      menu: document.getElementById('screen-menu')
    };

    this.loadingBar = document.getElementById('loading-bar');
    this.loadingText = document.getElementById('loading-text');
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

  showScreen(name) {
    Object.entries(this.screens).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== name);
    });
    i18n.applyToDOM();
  }

  hideAllScreens() {
    Object.values(this.screens).forEach((el) => el.classList.add('hidden'));
  }
}
