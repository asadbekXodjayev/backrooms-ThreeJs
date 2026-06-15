// Seeded, deterministic RNG. The maze is watertight *by construction*, which
// requires that any two chunks computing the same boundary wall arrive at the
// same answer — so all maze randomness flows through pure hash functions of
// (seed, x, z) rather than a stateful stream.

/** mulberry32 — fast, decent-quality 32-bit PRNG. Returns a stream function. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic hash of integer coords + seed → uint32. Pure, order-free. */
export function hash2(seed: number, x: number, y: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic float in [0,1) for a cell/edge. */
export function rand2(seed: number, x: number, y: number): number {
  return hash2(seed, x, y) / 4294967296;
}

/** Deterministic float in [0,1) keyed by three ints (e.g. seed, cell, channel). */
export function rand3(seed: number, x: number, y: number, k: number): number {
  return hash2(hash2(seed, x, y), k, 0x9e3779b9) / 4294967296;
}

/** A fresh random session seed. */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
