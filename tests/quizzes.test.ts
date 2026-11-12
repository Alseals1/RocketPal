import { describe, expect, it } from 'vitest';
import missionsJson from '../public/data/missions.json';
import planetsJson from '../public/data/planets.json';
import quizzesJson from '../public/data/quizzes.json';
import surfacesJson from '../public/data/surfaces.json';
import { validateMissions } from '../src/data/missions';
import { validateQuizzes } from '../src/data/quizzes';
import type { SurfaceData } from '../src/data/surfaces';

const surfaces = surfacesJson as unknown as SurfaceData;
const WORLDS = planetsJson.worlds.map((w) => w.id);
const quizzes = () => structuredClone(quizzesJson) as any;
const missions = () => structuredClone(missionsJson) as any;
const problemsWith = (change: (q: any) => void) => {
  const q = quizzes();
  change(q);
  return validateQuizzes(q, surfaces);
};
const marsQuiz = (q: any) => q.quizzes.find((x: any) => x.worldId === 'mars');

describe('quizzes.json', () => {
  it('is valid as shipped', () => {
    expect(validateQuizzes(quizzesJson, surfaces)).toEqual([]);
  });

  it('has a quiz of three questions for every world that has a landing picture', () => {
    for (const surface of surfaces.surfaces) {
      const quiz = quizzesJson.quizzes.find((q) => q.worldId === surface.worldId);
      expect(quiz, surface.worldId).toBeDefined();
      expect(quiz!.questions).toHaveLength(3);
    }
  });

  it('is rejected when it is not the right kind of thing', () => {
    expect(validateQuizzes(null, surfaces)).not.toEqual([]);
    expect(validateQuizzes({ quizzes: 'x' }, surfaces)).not.toEqual([]);
    expect(validateQuizzes([], surfaces)).not.toEqual([]);
  });

  it('needs a real date', () => {
    expect(problemsWith((q) => (q.lastChecked = 'last week')).join()).toMatch(/lastChecked/);
  });

  it('only has quizzes for worlds that have a landing picture, once each', () => {
    expect(problemsWith((q) => q.quizzes.push({ ...structuredClone(q.quizzes[0]), worldId: 'moon' })).join()).toMatch(/moon.*no landing picture/);
    expect(problemsWith((q) => q.quizzes.push(structuredClone(q.quizzes[0]))).join()).toMatch(/more than once/);
  });

  it('has exactly three questions in a quiz', () => {
    expect(problemsWith((q) => marsQuiz(q).questions.pop()).join()).toMatch(/exactly 3 questions/);
    expect(problemsWith((q) => marsQuiz(q).questions.push(structuredClone(marsQuiz(q).questions[0]))).join()).toMatch(/exactly 3 questions/);
  });

  it('has exactly three different options and exactly one right one in every question', () => {
    expect(problemsWith((q) => marsQuiz(q).questions[0].options.pop()).join()).toMatch(/exactly 3 options/);
    expect(problemsWith((q) => marsQuiz(q).questions[0].options.forEach((o: any) => (o.correct = false))).join()).toMatch(/exactly one right/);
    expect(problemsWith((q) => marsQuiz(q).questions[0].options.forEach((o: any) => (o.correct = true))).join()).toMatch(/exactly one right/);
    expect(problemsWith((q) => (marsQuiz(q).questions[0].options[0].text = marsQuiz(q).questions[0].options[1].text)).join()).toMatch(/different/);
  });

  it('keeps words short enough for ages 8 to 10', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone?';
    expect(problemsWith((q) => (marsQuiz(q).questions[0].question = long)).join()).toMatch(/question.*words/);
    expect(problemsWith((q) => (marsQuiz(q).questions[0].options[0].text = 'one two three four five six seven eight nine')).join()).toMatch(/option.*words/);
    expect(problemsWith((q) => (marsQuiz(q).questions[0].because = long.replace('?', '.') + ' Plus more words after it.')).join()).toMatch(/because/);
  });

  it('asks questions (ends with a question mark) and explains answers in plain text', () => {
    expect(problemsWith((q) => (marsQuiz(q).questions[0].question = 'Tell me about Mars.')).join()).toMatch(/question mark/);
    expect(problemsWith((q) => (marsQuiz(q).questions[0].because = '')).join()).toMatch(/because/);
  });

  it('gives every question its own id', () => {
    expect(problemsWith((q) => (marsQuiz(q).questions[1].id = marsQuiz(q).questions[0].id)).join()).toMatch(/id/);
  });

  it('builds every question from a real dot on that world', () => {
    expect(problemsWith((q) => (marsQuiz(q).questions[0].hotspot = 'no-such-dot')).join()).toMatch(/no-such-dot/);
    // A dot from the other world is not a dot of this world.
    expect(problemsWith((q) => (marsQuiz(q).questions[0].hotspot = 'aurora')).join()).toMatch(/aurora/);
  });

  it('proves the right answer from the dot\'s own words: the evidence phrase must be in that dot', () => {
    expect(problemsWith((q) => (marsQuiz(q).questions[0].evidence = 'a phrase that is nowhere in the fact')).join()).toMatch(/evidence/);
    expect(problemsWith((q) => delete marsQuiz(q).questions[0].evidence).join()).toMatch(/evidence/);
  });

  it('never lets a wrong option repeat the evidence (so a wrong answer cannot also be right)', () => {
    const problems = problemsWith((q) => {
      const first = marsQuiz(q).questions[0];
      const wrong = first.options.find((o: any) => !o.correct);
      wrong.text = `Because ${first.evidence}`;
    });
    expect(problems.join()).toMatch(/wrong option.*evidence/);
  });

  it('only accepts a right answer whose words are all in the dot it comes from', () => {
    // The paint answer marked right instead of the iron one: paint is nowhere in the Mars fact.
    const problems = problemsWith((q) => {
      const first = marsQuiz(q).questions[0];
      first.options.forEach((o: any) => (o.correct = /paint/.test(o.text)));
    });
    expect(problems.join()).toMatch(/right answer.*words.*not in the/);
  });

  it('only accepts a wrong answer that brings in something the dot does not say', () => {
    // A wrong option made only of the dot's own words would be right as well.
    const problems = problemsWith((q) => {
      const first = marsQuiz(q).questions[0];
      first.options.find((o: any) => !o.correct).text = 'The iron in the dirt';
    });
    expect(problems.join()).toMatch(/wrong option.*only words from the dot/);
  });

  it('wants the "because" line to come from the dot, not be made up', () => {
    const problems = problemsWith((q) => (marsQuiz(q).questions[0].because = 'Mars is made of cheese and glows in the dark.'));
    expect(problems.join()).toMatch(/because.*not from the/);
  });

  it('does not let the right answer be the longest option in every question (it would give the answer away)', () => {
    const problems = problemsWith((q) => {
      for (const question of marsQuiz(q).questions) {
        question.options.forEach((o: any, i: number) => {
          if (!o.correct) o.text = `W${i}`; // two characters each, so the right answer is the longest everywhere
        });
      }
    });
    expect(problems.join()).toMatch(/longest/);
  });

  it('judges "longest" by characters, not words', () => {
    // The right answer is one word but 20 characters; each wrong one is four words but only 7 characters.
    // By words the right answer is the shortest; by characters it is the longest in every question, which is what must be caught.
    const problems = problemsWith((q) => {
      for (const question of marsQuiz(q).questions) {
        question.options.forEach((o: any, i: number) => {
          o.text = o.correct ? 'Supercalifragilistic' : `a b c ${i}`;
        });
      }
    });
    expect(problems.join()).toMatch(/longest/);
  });

  it('puts the right answer in more than one position in a quiz, so it is not always the same button', () => {
    expect(
      problemsWith((q) => {
        for (const question of marsQuiz(q).questions) {
          const right = question.options.findIndex((o: any) => o.correct);
          [question.options[0], question.options[right]] = [question.options[right], question.options[0]];
        }
      }).join(),
    ).toMatch(/same position/);
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
      expect(quizzesJson.quizzes.some((q) => q.worldId === surface.worldId), `quiz for ${surface.worldId}`).toBe(true);
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
