import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { deriveProgression, diffProgression, record, type ProgressionView } from '../src/core/progression';
import { emptySave, migrate, type SaveData } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import { realFiles } from './fixtures/content';
import { randomSaves } from './fixtures/seeded';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

const save = (fields: Record<string, unknown>): SaveData => migrate({ version: 2, ...fields });
const diffOf = (s: SaveData, e: GameEvent) => diffProgression(deriveProgression(s, content), deriveProgression(record(s, e, content), content));
const NOTHING = { xpGained: 0, newStars: [], newPatches: [], newItems: [], newPages: [], missionsDone: [], chaptersDone: [] };

describe('diffProgression, per event', () => {
  it('arrived: nothing to reward yet', () => {
    expect(diffOf(emptySave(), { type: 'arrived', place: 'mars' })).toEqual(NOTHING);
  });

  it('a new dot: its XP and its Journal page', () => {
    expect(diffOf(emptySave(), { type: 'dotFound', dot: 'mars/rim' })).toEqual({ ...NOTHING, xpGained: 5, newPages: ['mars/rim'] });
  });

  it('the dot that finishes "find 3": the mission, its star and a rank-up', () => {
    const s = save({ dots: ['mars/rim', 'mars/sky'], quizzes: { earth: { done: true, perfect: true } } }); // 10 + 30 XP
    expect(diffOf(s, { type: 'dotFound', dot: 'mars/rover' })).toEqual({
      ...NOTHING,
      xpGained: 5 + 20,
      rankUp: { from: 1, to: 2 },
      newStars: [{ place: 'mars', count: 1 }],
      newPages: ['mars/rover'],
      missionsDone: ['find-3-mars'],
    });
  });

  it('a dot found again: one XP, no new page', () => {
    expect(diffOf(save({ dots: ['mars/rim'] }), { type: 'dotFound', dot: 'mars/rim' })).toEqual({ ...NOTHING, xpGained: 1 });
  });

  it('a perfect quiz: two stars, with the new total', () => {
    const s = save({ dots: ['earth/air', 'earth/aurora', 'earth/clouds'], worlds: { earth: { missionDone: true, quizDone: false, perfectQuiz: false } } });
    expect(diffOf(s, { type: 'quizFinished', place: 'earth', firstTryAll: true })).toEqual({
      ...NOTHING,
      xpGained: 30, // 35 -> 65
      rankUp: { from: 1, to: 2 },
      newStars: [{ place: 'earth', count: 3 }],
    });
  });

  it('a quiz finished again: its replay XP and no stars', () => {
    const s = save({ quizzes: { mars: { done: true, perfect: true } } });
    expect(diffOf(s, { type: 'quizFinished', place: 'mars', firstTryAll: false })).toEqual({ ...NOTHING, xpGained: 5 });
  });

  it('events the recorder does not write give nothing', () => {
    expect(diffOf(save({ dots: ['mars/rim'] }), { type: 'capsuleCollected', capsule: 'x' })).toEqual(NOTHING);
  });
});

describe('diffProgression on views', () => {
  const view = (over: Partial<ProgressionView>): ProgressionView => ({ ...deriveProgression(emptySave(), content), ...over });

  it('never reports negative XP, and lists only what is new, in after\'s order', () => {
    const before = view({ xp: 50, unlocked: new Set(['a']), patches: new Map([['p1', { earned: true }]]) });
    const after = view({
      xp: 40,
      unlocked: new Set(['a', 'c', 'b']),
      patches: new Map([['p1', { earned: true }], ['p2', { earned: false }], ['p3', { earned: true, date: '2026-11-12' }]]),
      chapters: new Map([['home', { done: true, steps: 3, stepsDone: 3 }], ['rocky', { done: false, steps: 3, stepsDone: 1 }]]),
      stars: { total: 2, byPlace: new Map([['mars', 0]]), byCourse: new Map([['cadet', 2]]) },
    });
    expect(diffProgression(before, after)).toEqual({
      ...NOTHING,
      newItems: ['c', 'b'],
      newPatches: ['p3'],
      chaptersDone: ['home'],
      newStars: [{ place: 'cadet', count: 2 }],
    });
  });
});

describe('the same save and event always give the same diff (acceptance 4)', () => {
  it('on random saves, for every recorded event type', () => {
    const { pick, coin, save: randomSave } = randomSaves(4);
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const dots = [...content.arrivals].flatMap(([p, a]) => a.hotspots.map((h) => `${p}/${h.id}`));
    for (let i = 0; i < 200; i++) {
      const s = randomSave();
      const events: GameEvent[] = [
        { type: 'arrived', place: pick(['mars', 'earth', 'venus']) },
        { type: 'dotFound', dot: pick(dots) as never },
        { type: 'quizFinished', place: pick(['mars', 'earth']), firstTryAll: coin() },
        { type: 'bump' },
      ];
      for (const e of events) {
        expect(record(s, e, content)).toEqual(record(s, e, content));
        expect(diffOf(s, e)).toEqual(diffOf(s, e));
      }
    }
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    random.mockRestore();
    now.mockRestore();
  });
});
