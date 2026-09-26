// Deterministic, seedable PRNG so a given level number always generates
// the exact same garden — required for the "replay the same level" rule
// even though the layout itself is now procedural instead of hand-authored.

export function hashSeed(n) {
  let x = (n ^ 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}

// mulberry32 — small, fast, good-enough distribution for level layout.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}
