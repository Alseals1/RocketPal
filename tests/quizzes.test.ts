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

  it('is valid as shipped', () => {
    expect(check(missionsJson)).toEqual([]);
  });

  it('has a mission for every world that has a landing picture, and a quiz to go with it', () => {
    for (const surface of surfaces.surfaces) {
      expect(missionsJson.missions.some((m) => m.worldId === surface.worldId), `mission for ${surface.worldId}`).toBe(true);
      expect(quizzesJson.quizzes.some((q) => q.worldId === surface.worldId), `quiz for ${surface.worldId}`).toBe(true);
    }
  });

  it('asks for a number of dots the world really has', () => {
    const marsDots = surfaces.surfaces.find((s) => s.worldId === 'mars')!.hotspots.length;
    const tooMany = missions();
    tooMany.missions.find((m: any) => m.worldId === 'mars').findCount = marsDots + 1;
    expect(check(tooMany).join()).toMatch(/findCount/);
    const none = missions();
    none.missions[0].findCount = 0;
    expect(check(none).join()).toMatch(/findCount/);
    const half = missions();
    half.missions[0].findCount = 1.5;
    expect(check(half).join()).toMatch(/findCount/);
  });

  it('only has missions for worlds with a landing picture, once each, and points its teaser at a real world', () => {
    const extra = missions();
    extra.missions.push({ ...extra.missions[0], worldId: 'moon' });
    expect(check(extra).join()).toMatch(/moon.*no landing picture/);
    const twice = missions();
    twice.missions.push(structuredClone(twice.missions[0]));
    expect(check(twice).join()).toMatch(/more than once/);
    const lost = missions();
    lost.missions[0].teaserWorld = 'pluto';
    expect(check(lost).join()).toMatch(/teaserWorld/);
  });

  it('keeps every line short and present', () => {
    for (const field of ['title', 'done', 'teaser']) {
      const empty = missions();
      empty.missions[0][field] = '';
      expect(check(empty).join(), field).toMatch(new RegExp(field));
      const long = missions();
      long.missions[0][field] = 'word '.repeat(60).trim() + '.';
      expect(check(long).join(), field).toMatch(new RegExp(field));
    }
  });

  it('is rejected when it is not the right kind of thing', () => {
    expect(check(null)).not.toEqual([]);
    expect(check({ missions: {} })).not.toEqual([]);
  });
});
