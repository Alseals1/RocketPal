/**
 * A small seeded random number generator (mulberry32, the same as in tests/saveSchema.test.ts), so "random" saves are
 * the same on every run, and a random save built from the facts progression reads.
 */
import { migrate, type SaveData } from '../../src/core/save/schema';

export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Places with and without a landing picture, and one that is not in the content. */
export const PLACES = ['mars', 'earth', 'venus', 'moon', 'pluto'] as const;
/** Real dots, plus ids the pictures do not have (they must be ignored). */
export const DOTS = [
  'mars/rim',
  'mars/ground',
  'mars/sky',
  'mars/rover',
  'mars/photo',
  'earth/aurora',
  'earth/air',
  'earth/clouds',
  'earth/array',
  'earth/speed',
  'earth/about',
  'mars/nothing',
  'venus/cloud',
  'mars:rim',
] as const;

/** Random saves made only of the facts progression reads, cleaned up the way a stored one would be. */
export function randomSaves(seed: number) {
  const rand = seeded(seed);
  const coin = () => rand() < 0.5;
  const some = <T>(xs: readonly T[], p = 0.4) => xs.filter(() => rand() < p);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const recordOf = <T>(make: () => T) => Object.fromEntries(some(PLACES).map((id) => [id, make()]));
  const save = (): SaveData =>
    migrate({
      version: 2,
      worlds: recordOf(() => ({ missionDone: rand() < 0.2, quizDone: coin(), perfectQuiz: rand() < 0.3 })),
      visited: some(PLACES),
      dots: some(DOTS, rand()),
      capsules: some(['c1', 'c2', 'c3']),
      quizzes: recordOf(() => ({ done: coin(), perfect: rand() < 0.3 })),
      courses: Object.fromEntries(some(['cadet', 'pilot']).map((id) => [id, { finish: coin(), crystals: coin(), smooth: coin() }])),
      activities: some(['lineup:mars', 'lineup:earth', 'rover:mars']),
      repeats: Object.fromEntries(
        some(['dot:mars/rim', 'dot:earth/air', 'quiz:mars', 'quiz:earth', 'quiz:venus', 'dot:mars/nothing']).map((k) => [k, Math.floor(rand() * 14)]),
      ),
    });
  return { rand, coin, pick, some, save };
}
