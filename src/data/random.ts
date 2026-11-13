/**
 * Seeded randomness for content draws (which questions a quiz asks, and in which order). The same seed always gives the
 * same numbers, so a draw can be tested. It never decides a reward: stars and XP do not depend on it.
 */

/** mulberry32: a small, fast generator. Returns numbers in [0, 1). Any number works as a seed. */
export function seededRandom(seed: number): () => number {
  let a = Math.trunc(Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of `list` (Fisher-Yates). The list itself is left alone. */
export function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
