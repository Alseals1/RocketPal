import { describe, expect, it } from 'vitest';
import missionsJson from '../public/data/missions.json';
import planetsJson from '../public/data/planets.json';
import quizzesJson from '../public/data/quizzes.json';
import surfacesJson from '../public/data/surfaces.json';
import { validateMissions } from '../src/data/missions';
import { checkPool, validateQuestionPools } from '../src/data/quizzes';
import type { SurfaceData } from '../src/data/surfaces';

const surfaces = surfacesJson as unknown as SurfaceData;
const marsSurface = surfaces.surfaces.find((s) => s.worldId === 'mars')!;
const WORLDS = planetsJson.worlds.map((w) => w.id);
const quizzes = () => structuredClone(quizzesJson) as any;
const missions = () => structuredClone(missionsJson) as any;
const problemsWith = (change: (q: any) => void) => {
  const q = quizzes();
  change(q);
  return validateQuestionPools(q, surfaces);
};
const marsPool = (q: any) => q.pools.find((x: any) => x.place === 'mars');
const earthPool = (q: any) => q.pools.find((x: any) => x.place === 'earth');
const marsQ = (q: any, id: string) => marsPool(q).questions.find((x: any) => x.id === id);
/** Every shipped question, with its pool's place. */
const allQuestions = () => quizzesJson.pools.flatMap((p) => p.questions.map((question) => ({ place: p.place, question })));

/**
 * Breaks one Mars question (mars-red unless told otherwise) and checks that it, and only it, is reported and left out:
 * the problem names `mars/<id>`, and the rest of the pool is still kept.
 */
function rejectsQuestion(change: (question: any, q: any) => void, pattern: RegExp, id = 'mars-red') {
  const q = quizzes();
  change(marsQ(q, id), q);
  const problems = validateQuestionPools(q, surfaces);
  expect(problems.filter((p) => pattern.test(p)), problems.join('\n')).not.toEqual([]);
  expect(problems.every((p) => p.startsWith(`mars/${id}: `)), problems.join('\n')).toBe(true);
  const { pool } = checkPool(marsPool(q), marsSurface);
  expect(pool, 'the pool is kept').toBeDefined();
  expect(pool!.questions.map((x) => x.id)).toEqual(marsPool(quizzes()).questions.map((x: any) => x.id).filter((x: string) => x !== id));
}

/** A postcard pool on Mars made of these shipped Mars questions. */
const postcard = (...ids: string[]) => ({
  lastChecked: '2026-10-23',
  pools: [{ place: 'mars', format: 'postcard', questions: ids.map((id) => marsQ(quizzes(), id)) }],
});

describe('quizzes.json', () => {
  it('is valid as shipped', () => {
    expect(validateQuestionPools(quizzesJson, surfaces)).toEqual([]);
  });

  it('has a quiz pool for every world that has a landing picture', () => {
    for (const surface of surfaces.surfaces) {
      const pool = quizzesJson.pools.find((p) => p.place === surface.worldId);
      expect(pool, surface.worldId).toBeDefined();
      expect(pool!.format).toBe('quiz');
    }
  });

  it('ships 8 questions for Mars and 9 for Earth, at every level, with enough at levels 1 and 2 for a new pilot', () => {
    expect(marsPool(quizzes()).questions).toHaveLength(8);
    expect(earthPool(quizzes()).questions).toHaveLength(9);
    for (const pool of quizzesJson.pools) {
      const levels = pool.questions.map((q) => q.level);
      expect(new Set(levels), pool.place).toEqual(new Set([1, 2, 3]));
      expect(levels.filter((l) => l <= 2).length, pool.place).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every existing question', () => {
    const ids = allQuestions().map((x) => x.question.id);
    for (const id of ['mars-red', 'mars-rover', 'mars-lake', 'earth-aurora', 'earth-orbit', 'earth-air']) expect(ids).toContain(id);
  });

  it('is rejected when it is not the right kind of thing', () => {
    expect(validateQuestionPools(null, surfaces)).toEqual(['quiz data must be an object']);
    expect(validateQuestionPools({ lastChecked: '2026-10-23', pools: 'x' }, surfaces)).toEqual(['pools must be a list']);
    expect(validateQuestionPools([], surfaces)).toEqual(['quiz data must be an object']);
    // The old shape (a list of quizzes) is not read as pools.
    expect(validateQuestionPools({ lastChecked: '2026-10-23', quizzes: [] }, surfaces)).toEqual(['pools must be a list']);
  });

  it('needs a real date', () => {
    expect(problemsWith((q) => (q.lastChecked = 'last week')).join()).toMatch(/lastChecked/);
  });

  it('only has pools for worlds that have a landing picture, once each', () => {
    expect(problemsWith((q) => q.pools.push({ ...structuredClone(q.pools[0]), place: 'moon' }))).toEqual(['moon: has a quiz but no landing picture']);
    expect(problemsWith((q) => q.pools.push(structuredClone(q.pools[0])))).toEqual(['mars: has a quiz more than once']);
  });

  it('drops a pool that is not an object, has a bad format or has no question list', () => {
    expect(checkPool(null, marsSurface)).toEqual({ problems: ['a pool must be an object'] });
    expect(checkPool([], marsSurface)).toEqual({ problems: ['a pool must be an object'] });
    for (const format of ['test', undefined, 3]) {
      const pool = { ...marsPool(quizzes()), format };
      expect(checkPool(pool, marsSurface), String(format)).toEqual({ problems: ['mars: format must be "quiz" or "postcard"'] });
    }
    expect(checkPool({ ...marsPool(quizzes()), questions: 'x' }, marsSurface)).toEqual({ problems: ['mars: questions must be a list'] });
    expect(checkPool(marsPool(quizzes()), undefined)).toEqual({ problems: ['mars: has a quiz but no landing picture'] });
  });

  it('has 6 to 9 questions in a quiz pool, and still keeps one that is outside that', () => {
    const small = quizzes();
    marsPool(small).questions.splice(5); // keeps rover, lake, sky, sky-color and photos: all levels 1 and 2
    expect(validateQuestionPools(small, surfaces)).toEqual(['mars: needs 6 to 9 questions (has 5)']);
    expect(checkPool(marsPool(small), marsSurface).pool?.questions).toHaveLength(5);

    const big = quizzes();
    for (const [i, id] of ['mars-sky', 'mars-photos'].entries()) {
      big.pools[0].questions.push({ ...structuredClone(marsQ(big, id)), id: `${id}-copy`, question: `Question ${i}: ${marsQ(big, id).question}` });
    }
    expect(validateQuestionPools(big, surfaces)).toEqual(['mars: needs 6 to 9 questions (has 10)']);
  });

  it('has 2 to 4 questions in a postcard pool', () => {
    expect(validateQuestionPools(postcard('mars-rover', 'mars-sky-color'), surfaces)).toEqual([]);
    expect(validateQuestionPools(postcard('mars-rover', 'mars-sky-color', 'mars-photos', 'mars-lake'), surfaces)).toEqual([]);
    expect(validateQuestionPools(postcard('mars-rover'), surfaces)).toEqual(['mars: needs 2 to 4 questions (has 1)']);
    expect(validateQuestionPools(postcard('mars-rover', 'mars-sky-color', 'mars-photos', 'mars-lake', 'mars-sky'), surfaces)).toEqual([
      'mars: needs 2 to 4 questions (has 5)',
    ]);
    // A postcard asks one question, so one good question at level 1 or 2 is enough to keep it.
    expect(checkPool(postcard('mars-rover').pools[0], marsSurface).pool?.questions).toHaveLength(1);
  });

  it('drops a pool that has too few good questions at levels 1 and 2 to fill a draw', () => {
    const q = quizzes();
    for (const id of ['mars-lake', 'mars-sky', 'mars-sky-color', 'mars-photos']) marsQ(q, id).hotspot = 'no-such-dot';
    const { pool, problems } = checkPool(marsPool(q), marsSurface);
    expect(pool).toBeUndefined();
    expect(problems.at(-1)).toBe('mars: needs at least 3 good questions at level 1 or 2 to make a quiz (has 2)');

    const noEasy = { lastChecked: '2026-10-23', pools: [{ place: 'mars', format: 'postcard', questions: [marsQ(quizzes(), 'mars-red'), marsQ(quizzes(), 'mars-rover-job')] }] };
    const result = checkPool(noEasy.pools[0], marsSurface);
    expect(result.pool).toBeUndefined();
    expect(result.problems).toContain('mars: needs at least 1 good questions at level 1 or 2 to make a postcard (has 0)');
  });

  it('gives every question a level of 1, 2 or 3', () => {
    for (const level of [0, 4, 1.5, '2', undefined]) {
      rejectsQuestion((question) => (question.level = level), /mars\/mars-red: level must be 1, 2 or 3/);
    }
  });

  it('has exactly three different options and exactly one right one in every question', () => {
    rejectsQuestion((question) => question.options.pop(), /exactly 3 options/);
    rejectsQuestion((question) => question.options.forEach((o: any) => (o.correct = false)), /exactly one right/);
    rejectsQuestion((question) => question.options.forEach((o: any) => (o.correct = true)), /exactly one right/);
    rejectsQuestion((question) => (question.options[0].text = question.options[1].text), /different/);
  });

  it('keeps words short enough for ages 8 to 10', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone?';
    rejectsQuestion((question) => (question.question = long), /question.*words/);
    rejectsQuestion((question) => (question.options[0].text = 'one two three four five six seven eight nine'), /option.*words/);
    rejectsQuestion((question) => (question.because = long.replace('?', '.') + ' Plus more words after it.'), /because/);
  });

  it('asks questions (ends with a question mark) and explains answers in plain text', () => {
    rejectsQuestion((question) => (question.question = 'Tell me about Mars.'), /question mark/);
    rejectsQuestion((question) => (question.because = ''), /because/);
  });

  it('gives every question its own id, and never asks the same thing twice in a pool', () => {
    expect(problemsWith((q) => (marsQ(q, 'mars-red').id = 'Mars Red'))).toEqual(['mars/Mars Red: id is required (lower case letters, numbers and dashes)']);
    const sameId = problemsWith((q) => (marsQ(q, 'mars-lake').id = 'mars-rover'));
    expect(sameId).toEqual(['mars/mars-rover: id is used by another question in this quiz']);
    const sameQuestion = problemsWith((q) => (marsQ(q, 'mars-sky').question = `  ${marsQ(q, 'mars-rover').question.toUpperCase()} `));
    expect(sameQuestion).toEqual(['mars/mars-sky: asks the same question as another one in this pool']);
    // The second copy is the one left out.
    const q = quizzes();
    marsQ(q, 'mars-sky').question = marsQ(q, 'mars-rover').question;
    expect(checkPool(marsPool(q), marsSurface).pool!.questions.map((x) => x.id)).not.toContain('mars-sky');
    expect(checkPool(marsPool(q), marsSurface).pool!.questions.map((x) => x.id)).toContain('mars-rover');
  });

  it('builds every question from a real dot on that world', () => {
    rejectsQuestion((question) => (question.hotspot = 'no-such-dot'), /no-such-dot/);
    // A dot from the other world is not a dot of this world.
    rejectsQuestion((question) => (question.hotspot = 'aurora'), /aurora/);
  });

  it("proves the right answer from the dot's own words: the evidence phrase must be in that dot", () => {
    rejectsQuestion((question) => (question.evidence = 'a phrase that is nowhere in the fact'), /evidence/);
    rejectsQuestion((question) => delete question.evidence, /evidence/);
  });

  it('never lets a wrong option repeat the evidence (so a wrong answer cannot also be right)', () => {
    rejectsQuestion((question) => (question.options.find((o: any) => !o.correct).text = `Because ${question.evidence}`), /wrong option.*evidence/);
  });

  it('only accepts a right answer whose words are all in the dot it comes from', () => {
    // The paint answer marked right instead of the iron one: paint is nowhere in the Mars fact.
    rejectsQuestion((question) => question.options.forEach((o: any) => (o.correct = /paint/.test(o.text))), /right answer.*words.*not in the/);
  });

  it('only accepts a wrong answer that brings in something the dot does not say', () => {
    // A wrong option made only of the dot's own words would be right as well.
    rejectsQuestion((question) => (question.options.find((o: any) => !o.correct).text = 'The iron in the dirt'), /wrong option.*only words from the dot/);
  });

  it('wants the "because" line to come from the dot, not be made up', () => {
    rejectsQuestion((question) => (question.because = 'Mars is made of cheese and glows in the dark.'), /because.*not from the/);
  });

  it('runs every check on every question in every pool', () => {
    // The same break on any question is caught and names that question.
    for (const { place, question } of allQuestions()) {
      const problems = problemsWith((q) => (q.pools.find((p: any) => p.place === place).questions.find((x: any) => x.id === question.id).evidence = 'not in any dot'));
      expect(problems, question.id).toEqual([`${place}/${question.id}: evidence "not in any dot" is not word for word in the text of the "${question.hotspot}" dot`]);
    }
  });

  /** Makes the right answer the longest option in these questions, keeping them valid (two-letter wrong answers). */
  const rightLongestIn = (pool: any, ids: string[]) => {
    for (const question of pool.questions.filter((x: any) => ids.includes(x.id))) {
      question.options.forEach((o: any, i: number) => {
        if (!o.correct) o.text = `W${i}`;
      });
    }
  };

  it('lets the right answer be the longest option in at most a third of a pool (it would give the answer away)', () => {
    // Earth has 9 questions; the right answer is the longest in 2 as shipped (earth-orbit, earth-air-shield).
    expect(problemsWith((q) => rightLongestIn(earthPool(q), ['earth-air']))).toEqual([]);
    expect(problemsWith((q) => rightLongestIn(earthPool(q), ['earth-air', 'earth-clouds']))).toEqual([
      'earth: the right answer is the longest option in more than a third of the questions, which gives it away',
    ]);
    // A pool with that problem is still kept: the answers are shuffled when it is drawn.
    const q = quizzes();
    rightLongestIn(earthPool(q), ['earth-air', 'earth-clouds']);
    expect(checkPool(earthPool(q), surfaces.surfaces.find((s) => s.worldId === 'earth')).pool?.questions).toHaveLength(9);
  });

  it('judges "longest" by characters, not words', () => {
    // The right answer is one word but 20 characters; each wrong one is four words but only 7 characters.
    // By words the right answer is the shortest; by characters it is the longest in every question, which is what must be caught.
    const problems = problemsWith((q) => {
      for (const question of marsPool(q).questions) {
        question.options.forEach((o: any, i: number) => {
          o.text = o.correct ? 'Supercalifragilistic' : `a b c ${i}`;
        });
      }
    });
    expect(problems.join()).toMatch(/longest/);
  });

  it('puts the right answer in more than one position in a pool, so it is not always the same button', () => {
    expect(
      problemsWith((q) => {
        for (const question of marsPool(q).questions) {
          const right = question.options.findIndex((o: any) => o.correct);
          [question.options[0], question.options[right]] = [question.options[right], question.options[0]];
        }
      }),
    ).toEqual(['mars: the right answer is in the same position in every question; mix it up']);
  });
});

describe('missions.json', () => {
  const check = (m: unknown) => validateMissions(m, surfaces, WORLDS);
  const mars = (m: any) => m.missions.find((x: any) => x.place === 'mars');

  it('is valid as shipped', () => {
    expect(check(missionsJson)).toEqual([]);
  });

  it('has a find mission for every world that has a landing picture, and a quiz to go with it', () => {
    for (const surface of surfaces.surfaces) {
      expect(missionsJson.missions.some((m) => m.kind === 'find' && m.place === surface.worldId), `mission for ${surface.worldId}`).toBe(true);
      expect(quizzesJson.pools.some((p) => p.place === surface.worldId), `quiz for ${surface.worldId}`).toBe(true);
    }
  });

  it('asks for a number of dots the world really has', () => {
    const marsDots = surfaces.surfaces.find((s) => s.worldId === 'mars')!.hotspots.length;
    const tooMany = missions();
    mars(tooMany).goal.count = marsDots + 1;
    expect(check(tooMany)).toEqual([
      `find-3-mars: goal: dotsFound count must be a whole number from 1 to the number of dots on the picture (${marsDots})`,
    ]);
    for (const count of [0, 1.5, '3']) {
      const bad = missions();
      mars(bad).goal.count = count;
      expect(check(bad).join(), String(count)).toMatch(/dotsFound count/);
    }
  });

  it('needs an id, the find kind, and a goal of dotsFound at its own place', () => {
    const noId = missions();
    delete mars(noId).id;
    expect(check(noId)).toContain('(mission without an id): id is required: lowercase letters, digits and dashes, at most 40 characters');
    const badId = missions();
    mars(badId).id = 'Find 3 on Mars';
    expect(check(badId).join()).toMatch(/id is required/);
    const kind = missions();
    mars(kind).kind = 'rescue';
    expect(check(kind)).toEqual(['find-3-mars: kind must be "find" (other kinds come with their own issues)']);
    const elsewhere = missions();
    mars(elsewhere).goal = { type: 'dotsFound', place: 'earth', count: 3 };
    expect(check(elsewhere)).toEqual(["find-3-mars: a find mission's goal must be dotsFound at its own place"]);
    const visited = missions();
    mars(visited).goal = { type: 'visited', place: 'mars' };
    expect(check(visited)).toEqual(["find-3-mars: a find mission's goal must be dotsFound at its own place"]);
    const unsupported = missions();
    mars(unsupported).goal = { type: 'rank', atLeast: 2 };
    expect(check(unsupported)).toEqual([
      "find-3-mars: a find mission's goal must be dotsFound at its own place",
      'find-3-mars: goal: "rank" is not supported yet',
    ]);
  });

  it('checks an available condition too', () => {
    const m = missions();
    mars(m).available = { type: 'visited', place: 'pluto' };
    expect(check(m)).toEqual(['find-3-mars: available: visited place must be a world in planets.json']);
  });

  it('only has missions for worlds with a landing picture, once each, one find per place, and points its teaser at a real world', () => {
    const extra = missions();
    extra.missions.push({ ...structuredClone(extra.missions[0]), id: 'find-3-moon', place: 'moon', goal: { type: 'dotsFound', place: 'moon', count: 3 } });
    expect(check(extra).join()).toMatch(/find-3-moon: has a mission but no landing picture/);
    const nowhere = missions();
    mars(nowhere).place = 'pluto';
    expect(check(nowhere)).toContain('find-3-mars: place must be a world in planets.json');
    const twice = missions();
    twice.missions.push(structuredClone(twice.missions[0]));
    expect(check(twice).join()).toMatch(/find-3-mars: listed twice/);
    const second = missions();
    second.missions.push({ ...structuredClone(mars(second)), id: 'find-2-mars' });
    expect(check(second)).toEqual(['find-2-mars: mars already has a find mission']);
    const lost = missions();
    mars(lost).teaser.place = 'pluto';
    expect(check(lost)).toEqual(['find-3-mars: teaser place must be a world in planets.json']);
    const noTeaser = missions();
    delete mars(noTeaser).teaser;
    expect(check(noTeaser)).toEqual([
      'find-3-mars: teaser text is required and at most 20 words',
      'find-3-mars: teaser place must be a world in planets.json',
    ]);
  });

  it('keeps every line short and present', () => {
    const lines: [string, (m: any, v: string) => void][] = [
      ['title', (m, v) => (m.title = v)],
      ['done', (m, v) => (m.done = v)],
      ['teaser text', (m, v) => (m.teaser.text = v)],
    ];
    for (const [field, set] of lines) {
      const empty = missions();
      set(mars(empty), '');
      expect(check(empty).join(), field).toMatch(new RegExp(field));
      const long = missions();
      set(mars(long), 'word '.repeat(60).trim() + '.');
      expect(check(long).join(), field).toMatch(new RegExp(field));
    }
  });

  it('is rejected when it is not the right kind of thing', () => {
    expect(check(null)).not.toEqual([]);
    expect(check({ missions: {} })).not.toEqual([]);
  });
});
