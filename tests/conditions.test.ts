import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  dotsFoundAt,
  isMet,
  isMissionDone,
  missionProgress,
  progressOf,
  quizState,
  starsAtPlace,
  type Condition,
} from '../src/core/conditions';
import { emptySave, migrate, type SaveData } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import type { MissionDef } from '../src/data/missions';
import { realFiles } from './fixtures/content';
import { randomSaves } from './fixtures/seeded';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

const save = (fields: Record<string, unknown>): SaveData => migrate({ version: 2, ...fields });
const both = (c: Condition, s: SaveData) => ({ met: isMet(c, s, content), progress: progressOf(c, s, content) });

describe('isMet and progressOf, for every kind', () => {
  it('visited', () => {
    const c: Condition = { type: 'visited', place: 'venus' };
    expect(both(c, emptySave())).toEqual({ met: false, progress: { done: 0, of: 1 } });
    expect(both(c, save({ visited: ['venus'] }))).toEqual({ met: true, progress: { done: 1, of: 1 } });
  });

  it('dotsFound counts that place\'s dots found ever, and ignores ids the picture does not have', () => {
    const c: Condition = { type: 'dotsFound', place: 'mars', count: 3 };
    expect(both(c, emptySave())).toEqual({ met: false, progress: { done: 0, of: 3 } });
    expect(both(c, save({ dots: ['mars/rim', 'mars/sky', 'mars/nothing', 'earth/air', 'mars:ground'] }))).toEqual({
      met: false,
      progress: { done: 2, of: 3 },
    });
    expect(both(c, save({ dots: ['mars/rim', 'mars/sky', 'mars/rover'] }))).toEqual({ met: true, progress: { done: 3, of: 3 } });
    expect(both(c, save({ dots: ['mars/rim', 'mars/sky', 'mars/rover', 'mars/photo'] }))).toEqual({ met: true, progress: { done: 3, of: 3 } });
    expect(both({ type: 'dotsFound', place: 'venus', count: 1 }, save({ dots: ['venus/cloud'] }))).toEqual({
      met: false,
      progress: { done: 0, of: 1 },
    });
  });

  it('quizDone, finished or perfect, from the v2 record or the v1 flags', () => {
    const done: Condition = { type: 'quizDone', place: 'mars' };
    const perfect: Condition = { type: 'quizDone', place: 'mars', perfect: true };
    expect(isMet(done, emptySave(), content)).toBe(false);
    const v2 = save({ quizzes: { mars: { done: true, perfect: false } } });
    expect([isMet(done, v2, content), isMet(perfect, v2, content)]).toEqual([true, false]);
    const v1 = save({ worlds: { mars: { missionDone: false, quizDone: true, perfectQuiz: true } } });
    expect([isMet(done, v1, content), isMet(perfect, v1, content)]).toEqual([true, true]);
    expect(progressOf(perfect, v2, content)).toEqual({ done: 0, of: 1 });
  });

  it('starsAt counts the stars on a place, and gives a course (or anything else) none yet', () => {
    const s = save({ quizzes: { mars: { done: true, perfect: false } }, worlds: { mars: { missionDone: true, quizDone: false, perfectQuiz: false } } });
    expect(both({ type: 'starsAt', place: 'mars', count: 3 }, s)).toEqual({ met: false, progress: { done: 2, of: 3 } });
    expect(both({ type: 'starsAt', place: 'mars', count: 2 }, s)).toEqual({ met: true, progress: { done: 2, of: 2 } });
    expect(both({ type: 'starsAt', place: 'belt-cadet', count: 1 }, s)).toEqual({ met: false, progress: { done: 0, of: 1 } });
  });

  it('courseDone, finished or a named star', () => {
    const s = save({ courses: { cadet: { finish: true, crystals: false, smooth: true } } });
    expect(isMet({ type: 'courseDone', course: 'cadet' }, s, content)).toBe(true);
    expect(isMet({ type: 'courseDone', course: 'cadet', star: 'smooth' }, s, content)).toBe(true);
    expect(both({ type: 'courseDone', course: 'cadet', star: 'crystals' }, s)).toEqual({ met: false, progress: { done: 0, of: 1 } });
    expect(isMet({ type: 'courseDone', course: 'ace' }, s, content)).toBe(false);
  });

  it('capsules counts every capsule collected', () => {
    const c: Condition = { type: 'capsules', count: 2 };
    expect(both(c, save({ capsules: ['a'] }))).toEqual({ met: false, progress: { done: 1, of: 2 } });
    expect(both(c, save({ capsules: ['a', 'b', 'c'] }))).toEqual({ met: true, progress: { done: 2, of: 2 } });
  });

  it('activityDone, for one key or for any', () => {
    const s = save({ activities: ['lineup:mars', 'rover-run:x'] });
    expect(isMet({ type: 'activityDone', activity: 'lineup', key: 'mars' }, s, content)).toBe(true);
    expect(isMet({ type: 'activityDone', activity: 'lineup', key: 'earth' }, s, content)).toBe(false);
    expect(isMet({ type: 'activityDone', activity: 'lineup' }, s, content)).toBe(true);
    expect(isMet({ type: 'activityDone', activity: 'rover' }, s, content)).toBe(false); // "rover-run:" is another activity
  });

  it('missionDone', () => {
    const c: Condition = { type: 'missionDone', mission: 'find-3-mars' };
    expect(both(c, emptySave())).toEqual({ met: false, progress: { done: 0, of: 1 } });
    expect(both(c, save({ dots: ['mars/rim', 'mars/sky', 'mars/rover'] }))).toEqual({ met: true, progress: { done: 1, of: 1 } });
    expect(isMet({ type: 'missionDone', mission: 'no-such-mission' }, emptySave(), content)).toBe(false);
  });

  it('chapterDone, rank and patch are never met yet', () => {
    const full = save({ dots: ['mars/rim', 'mars/sky', 'mars/rover'], visited: ['mars'] });
    for (const c of [
      { type: 'chapterDone', chapter: 'home' },
      { type: 'rank', atLeast: 1 },
      { type: 'patch', patch: 'first-flight' },
    ] as Condition[]) {
      expect(both(c, full)).toEqual({ met: false, progress: { done: 0, of: 1 } });
    }
  });

  it('all counts the children met; any is met by one', () => {
    const c: Condition[] = [
      { type: 'visited', place: 'mars' },
      { type: 'visited', place: 'earth' },
      { type: 'capsules', count: 1 },
    ];
    const s = save({ visited: ['mars'], capsules: ['x'] });
    expect(both({ type: 'all', of: c }, s)).toEqual({ met: false, progress: { done: 2, of: 3 } });
    expect(both({ type: 'all', of: [c[0], c[2]] }, s)).toEqual({ met: true, progress: { done: 2, of: 2 } });
    expect(both({ type: 'any', of: c }, s)).toEqual({ met: true, progress: { done: 1, of: 1 } });
    expect(both({ type: 'any', of: [c[1]] }, s)).toEqual({ met: false, progress: { done: 0, of: 1 } });
  });
});

describe('find missions and the v1 flag (D2)', () => {
  it('a v1 save with missionDone and no dots still has its mission done, shown as complete', () => {
    const v1 = migrate({ version: 1, worlds: { earth: { missionDone: true, quizDone: false, perfectQuiz: false } } });
    expect(isMissionDone(v1, content, 'find-3-earth')).toBe(true);
    expect(missionProgress(v1, content, 'find-3-earth')).toEqual({ done: 3, of: 3 });
    expect(isMet({ type: 'missionDone', mission: 'find-3-earth' }, v1, content)).toBe(true);
    expect(starsAtPlace(v1, content, 'earth')).toBe(1);
    expect(isMissionDone(v1, content, 'find-3-mars')).toBe(false);
  });

  it('a mission done by its dots, with no flag', () => {
    const s = save({ dots: ['earth/air', 'earth/aurora'] });
    expect(missionProgress(s, content, 'find-3-earth')).toEqual({ done: 2, of: 3 });
    const three = save({ dots: ['earth/air', 'earth/aurora', 'earth/speed'] });
    expect(isMissionDone(three, content, 'find-3-earth')).toBe(true);
    expect(missionProgress(three, content, 'find-3-earth')).toEqual({ done: 3, of: 3 });
  });

  it('an unknown mission is not done and has no progress', () => {
    expect(isMissionDone(emptySave(), content, 'nope')).toBe(false);
    expect(missionProgress(emptySave(), content, 'nope')).toEqual({ done: 0, of: 1 });
  });

  it('a world with a v1 flag and no mission in content keeps its star (Venus in the old-tab test)', () => {
    const s = save({ worlds: { venus: { missionDone: true, quizDone: false, perfectQuiz: false } } });
    expect(starsAtPlace(s, content, 'venus')).toBe(1);
  });

  it('two missions that wait for each other are never done, and do not loop forever', () => {
    const a: MissionDef = { id: 'a', kind: 'side', title: 'A', goal: { type: 'missionDone', mission: 'b' }, done: 'Done!' };
    const b: MissionDef = { id: 'b', kind: 'side', title: 'B', goal: { type: 'missionDone', mission: 'a' }, done: 'Done!' };
    const self: MissionDef = { id: 's', kind: 'side', title: 'S', goal: { type: 'any', of: [{ type: 'missionDone', mission: 's' }] }, done: 'Done!' };
    const looped = { ...content, missions: new Map([['a', a], ['b', b], ['s', self]]) };
    expect(isMissionDone(emptySave(), looped, 'a')).toBe(false);
    expect(isMet({ type: 'missionDone', mission: 'b' }, emptySave(), looped)).toBe(false);
    expect(progressOf({ type: 'missionDone', mission: 's' }, emptySave(), looped)).toEqual({ done: 0, of: 1 });
  });
});

describe('the helpers', () => {
  it('dotsFoundAt keeps picture order and drops unknown ids', () => {
    const s = save({ dots: ['mars/sky', 'mars/rim', 'mars/x', 'earth/air'] });
    expect(dotsFoundAt(s, content, 'mars')).toEqual(['mars/rim', 'mars/sky']);
    expect(dotsFoundAt(s, content, 'venus')).toEqual([]);
  });

  it('quizState ORs the v2 record and the v1 flags', () => {
    expect(quizState(emptySave(), 'mars')).toEqual({ done: false, perfect: false });
    expect(quizState(save({ quizzes: { mars: { done: true, perfect: false } }, worlds: { mars: { missionDone: false, quizDone: true, perfectQuiz: true } } }), 'mars')).toEqual({
      done: true,
      perfect: true,
    });
  });

  it('starsAtPlace adds the mission, the quiz and a perfect quiz', () => {
    const s = save({ dots: ['mars/rim', 'mars/sky', 'mars/rover'], quizzes: { mars: { done: true, perfect: true } } });
    expect(starsAtPlace(s, content, 'mars')).toBe(3);
    expect(starsAtPlace(emptySave(), content, 'mars')).toBe(0);
    expect(starsAtPlace(s, content, 'constructor')).toBe(0);
  });

  it('never stores anything: the save is not changed', () => {
    const s = save({ dots: ['mars/rim'], visited: ['mars'] });
    const before = structuredClone(s);
    isMet({ type: 'all', of: [{ type: 'dotsFound', place: 'mars', count: 1 }, { type: 'missionDone', mission: 'find-3-mars' }] }, s, content);
    starsAtPlace(s, content, 'mars');
    expect(s).toEqual(before);
  });
});

describe('isMet agrees with progressOf on random saves', () => {
  it('isMet(c) === (done === of), for many random conditions', () => {
    const { rand, pick, save: randomSave } = randomSaves(39);
    const places = ['mars', 'earth', 'venus', 'pluto'] as const;
    const leaf = (): Condition =>
      pick<() => Condition>([
        () => ({ type: 'visited', place: pick(places) as any }),
        () => ({ type: 'dotsFound', place: pick(places) as any, count: 1 + Math.floor(rand() * 6) }),
        () => ({ type: 'quizDone', place: pick(places) as any, ...(rand() < 0.5 ? { perfect: rand() < 0.5 } : {}) }),
        () => ({ type: 'starsAt', place: pick([...places, 'cadet']) as any, count: 1 + Math.floor(rand() * 3) }),
        () => ({ type: 'courseDone', course: pick(['cadet', 'pilot']), ...(rand() < 0.5 ? { star: pick(['finish', 'crystals', 'smooth'] as const) } : {}) }),
        () => ({ type: 'capsules', count: Math.floor(rand() * 4) }),
        () => ({ type: 'activityDone', activity: pick(['lineup', 'rover']), ...(rand() < 0.5 ? { key: pick(places) } : {}) }),
        () => ({ type: 'missionDone', mission: pick(['find-3-mars', 'find-3-earth', 'nope']) }),
        () => ({ type: 'rank', atLeast: 1 }),
      ])();
    const condition = (depth: number): Condition =>
      depth > 0 && rand() < 0.3
        ? { type: rand() < 0.5 ? 'all' : 'any', of: Array.from({ length: Math.floor(rand() * 4) }, () => condition(depth - 1)) }
        : leaf();
    let metCount = 0;
    for (let i = 0; i < 400; i++) {
      const c = condition(2);
      const s = randomSave();
      const p = progressOf(c, s, content);
      const m = isMet(c, s, content);
      expect(m, JSON.stringify(c)).toBe(p.done === p.of);
      expect(p.done).toBeGreaterThanOrEqual(0);
      expect(p.done).toBeLessThanOrEqual(p.of);
      if (m) metCount++;
    }
    expect(metCount).toBeGreaterThan(40); // the generator really makes both kinds
    expect(metCount).toBeLessThan(360);
  });

  it('uses no randomness or clock', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    isMet({ type: 'missionDone', mission: 'find-3-mars' }, save({ dots: ['mars/rim'] }), content);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });
});
