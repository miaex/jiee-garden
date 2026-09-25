// Local persistence for progress and settings.
// Kept behind a small interface so it can later be backed by a
// JIEE PLAY account/profile sync instead of localStorage.

const STORAGE_KEY = 'jiee-garden-save-v1';

const DEFAULT_SAVE = {
  highestLevelReached: 1,
  completedLevels: [],
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
      return { ...structuredClone(DEFAULT_SAVE), ...parsed, settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) } };
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
}

export const saveManager = new SaveManager();
