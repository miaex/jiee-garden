// Local persistence for progress, settings, and the player profile.
// Kept behind a small interface so it can later be backed by the real
// JIEE PLAY account/profile system instead of localStorage — see
// `getExternalProfile()` below for the intended integration point.

const STORAGE_KEY = 'jiee-garden-save-v2';

const DEFAULT_SAVE = {
  highestLevelReached: 1,
  completedLevels: [],
  totalCandies: 0,
  profile: {
    name: '',
    gender: 'x', // 'f' | 'm' | 'x' (x = unspecified/neutral)
    hasOnboarded: false
  },
  settings: {
    soundOn: true,
    lang: 'fr'
  }
};

class SaveManager {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        profile: { ...structuredClone(DEFAULT_SAVE.profile), ...(parsed.profile || {}) },
        settings: { ...structuredClone(DEFAULT_SAVE.settings), ...(parsed.settings || {}) }
      };
    } catch (e) {
      console.warn('Save data unreadable, resetting.', e);
      return structuredClone(DEFAULT_SAVE);
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not persist save data.', e);
    }
  }

  markLevelComplete(levelId) {
    if (!this.data.completedLevels.includes(levelId)) {
      this.data.completedLevels.push(levelId);
    }
    this.data.highestLevelReached = Math.max(this.data.highestLevelReached, levelId + 1);
    this._persist();
  }

  isLevelComplete(levelId) {
    return this.data.completedLevels.includes(levelId);
  }

  getSettings() {
    return this.data.settings;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this._persist();
  }

  // --- Player profile ---
  // Anthropic/JIEE integration note: once this game is embedded in JIEE
  // PLAY, `getExternalProfile()` is the single place to change — have it
  // read the host app's real profile (e.g. `window.JIEE_PLAY_PROFILE`,
  // or a postMessage handshake) and return {name, gender, lang}. When it
  // returns non-null, the game skips local onboarding entirely and uses
  // that data instead, without touching any other file.
  getExternalProfile() {
    if (typeof window !== 'undefined' && window.JIEE_PLAY_PROFILE) {
      const p = window.JIEE_PLAY_PROFILE;
      return { name: p.name || '', gender: p.gender || 'x', lang: p.lang || 'fr' };
    }
    return null;
  }

  hasProfile() {
    return !!this.getExternalProfile() || this.data.profile.hasOnboarded;
  }

  getProfile() {
    const external = this.getExternalProfile();
    if (external) return external;
    return { name: this.data.profile.name, gender: this.data.profile.gender, lang: this.data.settings.lang };
  }

  saveProfile({ name, gender, lang }) {
    this.data.profile.name = (name || '').slice(0, 24);
    this.data.profile.gender = gender || 'x';
    this.data.profile.hasOnboarded = true;
    if (lang) this.data.settings.lang = lang;
    this._persist();
  }

  // --- Candy economy ---
  addCandies(n) {
    this.data.totalCandies += n;
    this._persist();
    return this.data.totalCandies;
  }

  getTotalCandies() {
    return this.data.totalCandies;
  }
}

export const saveManager = new SaveManager();
