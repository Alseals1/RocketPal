import { describe, expect, it } from 'vitest';
import quizzesJson from '../public/data/quizzes.json';
import { drawDifferent, drawQuestions, POOL_RULES, type PoolQuestion, type QuestionPool, type QuizQuestion } from '../src/data/quizzes';
import { seededRandom, shuffled } from '../src/data/random';

const SEEDS = Array.from({ length: 500 }, (_, i) => i);
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];
const shipped = quizzesJson.pools as unknown as QuestionPool[];
const mars = shipped.find((p) => p.place === 'mars')!;
const earth = shipped.find((p) => p.place === 'earth')!;
/** A postcard pool for the tests (no fly-by world ships one yet): Mars questions at every level. */
const postcard: QuestionPool = {
  place: 'mars',
  format: 'postcard',
  questions: mars.questions.filter((q) => ['mars-rover', 'mars-sky-color', 'mars-red'].includes(q.id)),
};
const POOLS: [string, QuestionPool][] = [
  ['mars', mars],
  ['earth', earth],
  ['postcard', postcard],
];

const byId = (pool: QuestionPool, id: string) => pool.questions.find((q) => q.id === id)!;
const levelOf = (pool: QuestionPool, q: QuizQuestion) => byId(pool, q.id).level;
const rightIndex = (q: QuizQuestion) => q.options.findIndex((o) => o.correct);
const key = (draw: QuizQuestion[]) => JSON.stringify(draw.map((q) => [q.id, q.options.map((o) => o.text)]));

describe('drawQuestions', () => {
  it('always draws the right number of questions (3 for a quiz, 1 for a postcard), never one twice', () => {
    for (const [name, pool] of POOLS) {
      for (const rank of RANKS) {
        for (const seed of SEEDS) {
          const draw = drawQuestions(pool, rank, seed);
          expect(draw, `${name} rank ${rank} seed ${seed}`).toHaveLength(POOL_RULES[pool.format].draw);
          expect(new Set(draw.map((q) => q.id)).size).toBe(draw.length);
          for (const q of draw) expect(pool.questions.some((p) => p.id === q.id)).toBe(true);
        }
      }
    }
  });

  it('never asks two questions on the same dot, so one cannot give the other away', () => {
    for (const [name, pool] of POOLS) {
      for (const rank of RANKS) {
        for (const seed of SEEDS) {
          const dots = drawQuestions(pool, rank, seed).map((q) => q.hotspot);
          expect(new Set(dots).size, `${name} rank ${rank} seed ${seed}: ${dots.join(', ')}`).toBe(dots.length);
        }
      }
    }
  });

  it('still asks every dot: each question in a pool comes up across seeds at the ranks that may ask it', () => {
    for (const pool of [mars, earth]) {
      const seen = new Set<string>();
      for (const rank of [1, 5]) for (const seed of SEEDS) for (const q of drawQuestions(pool, rank, seed)) seen.add(q.id);
      expect([...seen].sort()).toEqual(pool.questions.map((q) => q.id).sort());
    }
  });

  it('a pool that skipped validation with too few dots still fills its draw, sharing a dot only then', () => {
    // Three easy questions on two dots (rim twice): the validator would drop this pool, but the draw must not come up short.
    const twoDots: QuestionPool = { place: 'mars', format: 'quiz', questions: ['mars-lake', 'mars-lake-age', 'mars-sky'].map((id) => byId(mars, id)) };
    for (const seed of SEEDS.slice(0, 50)) {
      expect(drawQuestions(twoDots, 1, seed).map((q) => q.id).sort()).toEqual(['mars-lake', 'mars-lake-age', 'mars-sky']);
    }
  });

  it('only asks levels 1 and 2 below rank 5', () => {
    for (const [name, pool] of POOLS) {
      for (const rank of [1, 2, 3, 4]) {
        for (const seed of SEEDS) {
          for (const q of drawQuestions(pool, rank, seed)) expect(levelOf(pool, q), `${name} rank ${rank} seed ${seed}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('asks exactly one level-3 question in a quiz from rank 5, in every position across seeds', () => {
    for (const pool of [mars, earth]) {
      for (const rank of [5, 6, 7, 8]) {
        const positions = new Set<number>();
        for (const seed of SEEDS) {
          const levels = drawQuestions(pool, rank, seed).map((q) => levelOf(pool, q));
          expect(levels.filter((l) => l === 3), `${pool.place} rank ${rank} seed ${seed}`).toHaveLength(1);
          positions.add(levels.indexOf(3));
        }
        expect(positions).toEqual(new Set([0, 1, 2]));
      }
    }
  });

  it('draws a postcard from every level from rank 5', () => {
    const levels = new Set(SEEDS.map((seed) => levelOf(postcard, drawQuestions(postcard, 5, seed)[0])));
    expect(levels).toEqual(new Set([1, 2, 3]));
  });

  it('a quiz pool without a level-3 question still draws 3 at rank 5', () => {
    const easy: QuestionPool = { ...mars, questions: mars.questions.filter((q) => q.level !== 3) };
    for (const seed of SEEDS) expect(drawQuestions(easy, 5, seed)).toHaveLength(3);
  });

  it("shuffles each question's answers: the same answers, exactly one right, and the right one in every position across seeds", () => {
    for (const [name, pool] of POOLS) {
      const positions = new Set<number>();
      for (const rank of RANKS) {
        for (const seed of SEEDS) {
          for (const q of drawQuestions(pool, rank, seed)) {
            const source = byId(pool, q.id);
            expect([...q.options].sort((a, b) => a.text.localeCompare(b.text))).toEqual(
              [...source.options].sort((a, b) => a.text.localeCompare(b.text)),
            );
            expect(q.options.filter((o) => o.correct)).toHaveLength(1);
            positions.add(rightIndex(q));
          }
        }
      }
      expect(positions, name).toEqual(new Set([0, 1, 2]));
    }
  });

  it('gives the question, because line and dot as written, without the evidence or level', () => {
    for (const q of drawQuestions(mars, 8, 7)) {
      const source = byId(mars, q.id);
      expect(Object.keys(q).sort()).toEqual(['because', 'hotspot', 'id', 'options', 'question']);
      expect(q).toMatchObject({ question: source.question, because: source.because, hotspot: source.hotspot });
    }
  });

  it('is pure: the same seed gives the same draw, and the pool is never changed', () => {
    for (const [, pool] of POOLS) {
      const before = structuredClone(pool);
      for (const seed of SEEDS.slice(0, 50)) {
        const draw = drawQuestions(pool, 5, seed);
        expect(drawQuestions(pool, 5, seed)).toEqual(draw);
        draw[0].options[0].text = 'changed'; // a draw is a copy: changing it does not reach the pool
      }
      expect(pool).toEqual(before);
    }
  });

  it('works with any number as a seed', () => {
    for (const seed of [-1, -123456, 0.5, 3.75, 2 ** 40, Number.MAX_SAFE_INTEGER, NaN, Infinity]) {
      const draw = drawQuestions(mars, 1, seed);
      expect(draw, String(seed)).toHaveLength(3);
      expect(drawQuestions(mars, 1, seed)).toEqual(draw);
    }
  });

  it('gives different draws for different seeds', () => {
    for (const [name, pool] of POOLS) {
      expect(new Set(SEEDS.map((seed) => key(drawQuestions(pool, 1, seed)))).size, name).toBeGreaterThan(10);
    }
  });

  it('tops up a short list from what is left, and never draws more than the pool holds', () => {
    const tiny: QuestionPool = { place: 'mars', format: 'quiz', questions: [byId(mars, 'mars-rover'), byId(mars, 'mars-red')] as PoolQuestion[] };
    for (const seed of SEEDS.slice(0, 50)) {
      const ids = drawQuestions(tiny, 1, seed).map((q) => q.id).sort();
      expect(ids).toEqual(['mars-red', 'mars-rover']);
    }
  });
});

describe('drawDifferent', () => {
  it('never repeats the last draw on the shipped pools', () => {
    for (const pool of [mars, earth]) {
      for (const rank of [1, 5]) {
        for (const seed of SEEDS.slice(0, 200)) {
          const last = drawQuestions(pool, rank, seed);
          // Asking again from the same seed would repeat the draw; drawDifferent moves past it.
          const next = drawDifferent(pool, rank, seed, last);
          expect(key(next.questions)).not.toBe(key(last));
          expect(next.questions).toEqual(drawQuestions(pool, rank, next.seed));
          expect(next.seed).toBeGreaterThan(seed);
        }
      }
    }
  });

  it('with no last draw, gives the draw for the seed itself', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(drawDifferent(mars, 1, seed)).toEqual({ questions: drawQuestions(mars, 1, seed), seed });
    }
  });

  it('gives up after 20 tries when the pool cannot give a different draw, and still returns one', () => {
    // Two questions whose answers all read the same: every draw looks the same (the validator would reject this pool).
    const same = (id: string): PoolQuestion => ({
      id,
      level: 1,
      question: `${id}?`,
      options: [
        { text: 'A', correct: true },
        { text: 'A', correct: false },
        { text: 'A', correct: false },
      ],
      because: 'Because.',
      hotspot: 'rim',
      evidence: 'rim',
    });
    const stuck: QuestionPool = { place: 'mars', format: 'postcard', questions: [same('one'), same('one')] };
    const last = drawQuestions(stuck, 1, 0);
    const result = drawDifferent(stuck, 1, 10, last);
    expect(result.seed).toBe(29);
    expect(result.questions).toEqual(drawQuestions(stuck, 1, 29));
  });
});

describe('seededRandom and shuffled', () => {
  it('gives numbers from 0 up to (not including) 1, the same for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const n = a();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(b()).toBe(n);
    }
  });

  it('returns a shuffled copy and leaves the list alone', () => {
    const list = [1, 2, 3, 4, 5, 6];
    const rand = seededRandom(3);
    const orders = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const out = shuffled(list, rand);
      expect([...out].sort()).toEqual(list);
      orders.add(out.join());
    }
    expect(list).toEqual([1, 2, 3, 4, 5, 6]);
    expect(orders.size).toBeGreaterThan(50);
    expect(shuffled([], rand)).toEqual([]);
  });
});
