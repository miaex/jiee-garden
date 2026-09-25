import { level01 } from './level01.js';

// New levels are registered here by id. The engine/game code never needs
// to change when a level is added — only this table grows.
const LEVELS = {
  1: level01
};

export const LevelLoader = {
  get(id) {
    const level = LEVELS[id];
    if (!level) {
      console.warn(`Level ${id} not found, falling back to level 1.`);
      return LEVELS[1];
    }
    return level;
  },
  maxLevelId() {
    return Math.max(...Object.keys(LEVELS).map(Number));
  }
};
