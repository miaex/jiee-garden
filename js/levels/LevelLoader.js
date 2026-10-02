import { level01 } from './level01.js';
import { level02 } from './level02.js';
import { generateProceduralLevel } from './ProceduralLevel.js';

// Levels 1-2 are hand-authored tutorials. Level 3 onward is generated
// procedurally (deterministically, from the level number) — there is no
// upper bound, which is what gives the "infinite levels" feel. Generated
// levels are cached per session so re-entering one (e.g. via pause →
// restart) doesn't redo the maze carve, though regenerating would give
// the exact same result anyway since it's seeded by the level number.
const CURATED_LEVELS = {
  1: level01,
  2: level02
};

// Generation itself is cheap (sub-millisecond even at level 999999 — it's
// just a seeded grid carve), so this cache is purely to avoid redoing that
// work on a quick restart, not something gameplay depends on. Capped so a
// very long play session can't let it grow without bound; Map preserves
// insertion order, so this evicts the least-recently-added entry, which is
// an adequate approximation of LRU for how this is actually used (nearby
// levels get revisited, distant ones don't).
const generatedCache = new Map();
const MAX_CACHED_LEVELS = 200;

export const LevelLoader = {
  get(id) {
    if (CURATED_LEVELS[id]) return CURATED_LEVELS[id];

    if (!generatedCache.has(id)) {
      if (generatedCache.size >= MAX_CACHED_LEVELS) {
        generatedCache.delete(generatedCache.keys().next().value);
      }
      generatedCache.set(id, generateProceduralLevel(id));
    }
    return generatedCache.get(id);
  },
  // Kept for compatibility; levels are effectively infinite now so nothing
  // should clamp against this except as a sanity ceiling.
  maxLevelId() {
    return Infinity;
  }
};
