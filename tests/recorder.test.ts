import { beforeAll, describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { RECORDED_EVENTS, record } from '../src/core/progression';
import { emptySave, migrate, type SaveData } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import { realFiles } from './fixtures/content';
import { V3_FROM_THE_FUTURE } from './fixtures/saves';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

const save = (fields: Record<string, unknown>): SaveData => migrate({ version: 2, ...fields });
const play = (s: SaveData, ...events: GameEvent[]) => events.reduce((acc, e) => record(acc, e, content), s);
const dot = (d: string): GameEvent => ({ type: 'dotFound', dot: d as never });

describe('record: arrived', () => {
  it('adds the place to visited, sorted, once', () => {
    const s = play(emptySave(), { type: 'arrived', place: 'mars' }, { type: 'arrived', place: 'earth' });
    expect(s.visited).toEqual(['earth', 'mars']);
    expect(record(s, { type: 'arrived', place: 'mars' }, content)).toBe(s);
  });

  it('ignores a place that is not in the content', () => {
    const s = emptySave();
    expect(record(s, { type: 'arrived', place: 'belt' }, content)).toBe(s);
  });
});

describe('record: dotFound', () => {
  it('adds a dot, sorted, and nothing else while the mission is not finished', () => {
    const s = play(emptySave(), dot('mars/sky'), dot('mars/rim'));
    expect(s.dots).toEqual(['mars/rim', 'mars/sky']);
    expect(s.worlds).toEqual({});
    expect(s.repeats).toEqual({});
  });

  it('the third dot finishes "find 3" and writes the v1 flag too (D3)', () => {
    const s = play(emptySave(), dot('mars/rim'), dot('mars/sky'), dot('mars/rover'));
    expect(s.worlds.mars).toEqual({ missionDone: true, quizDone: false, perfectQuiz: false });
  });

  it('dots found on an earlier visit count (D5)', () => {
    const earlier = save({ dots: ['earth/air', 'earth/clouds'] });
    expect(record(earlier, dot('earth/aurora'), content).worlds.earth.missionDone).toBe(true);
  });

  it('a dot already found counts a replay, up to the cap, and never adds it twice', () => {
    let s = play(emptySave(), dot('mars/rim'));
    s = play(s, dot('mars/rim'), dot('mars/rim'));
    expect(s.dots).toEqual(['mars/rim']);
    expect(s.repeats).toEqual({ 'dot:mars/rim': 2 });
    for (let i = 0; i < 20; i++) s = play(s, dot('mars/rim'));
    expect(s.repeats['dot:mars/rim']).toBe(10);
    expect(record(s, dot('mars/rim'), content)).toBe(s); // at the cap nothing changes
  });

  it('ignores dots the pictures do not have, and badly written ids', () => {
    const s = emptySave();
    for (const d of ['mars/nothing', 'venus/cloud', 'mars', 'mars:rim', '/rim', 'pluto/rim']) expect(record(s, dot(d), content)).toBe(s);
  });

  it('keeps the flags another window set', () => {
    const s = save({ worlds: { mars: { missionDone: false, quizDone: true, perfectQuiz: true, rings: 2 } }, dots: ['mars/rim', 'mars/sky'] });
    expect(record(s, dot('mars/photo'), content).worlds.mars).toEqual({ missionDone: true, quizDone: true, perfectQuiz: true, rings: 2 });
  });
});

describe('record: quizFinished', () => {
  it('writes the v2 record and the v1 flags', () => {
    const s = record(emptySave(), { type: 'quizFinished', place: 'earth', firstTryAll: false }, content);
    expect(s.quizzes).toEqual({ earth: { done: true, perfect: false } });
    expect(s.worlds).toEqual({ earth: { missionDone: false, quizDone: true, perfectQuiz: false } });
    expect(s.repeats).toEqual({});
  });

  it('a perfect quiz turns the bonus on, and a worse replay never turns it off', () => {
    let s = play(emptySave(), { type: 'quizFinished', place: 'mars', firstTryAll: true });
    expect(s.quizzes.mars).toEqual({ done: true, perfect: true });
    expect(s.worlds.mars.perfectQuiz).toBe(true);
    s = play(s, { type: 'quizFinished', place: 'mars', firstTryAll: false });
    expect(s.quizzes.mars).toEqual({ done: true, perfect: true });
    expect(s.worlds.mars.perfectQuiz).toBe(true);
    expect(s.repeats).toEqual({ 'quiz:mars': 1 });
  });

  it('a quiz finished in v1 counts as a replay the next time', () => {
    const v1 = migrate({ version: 1, worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: false } } });
    const s = record(v1, { type: 'quizFinished', place: 'mars', firstTryAll: true }, content);
    expect(s.repeats).toEqual({ 'quiz:mars': 1 });
    expect(s.worlds.mars).toEqual({ missionDone: true, quizDone: true, perfectQuiz: true });
  });

  it('counts replays up to the cap', () => {
    let s = emptySave();
    for (let i = 0; i < 15; i++) s = play(s, { type: 'quizFinished', place: 'earth', firstTryAll: false });
    expect(s.repeats['quiz:earth']).toBe(10);
  });

  it('ignores a place without a quiz', () => {
    const s = emptySave();
    expect(record(s, { type: 'quizFinished', place: 'venus', firstTryAll: true }, content)).toBe(s);
  });

  it('keeps unknown fields in the quiz entry', () => {
    const s = migrate({ ...V3_FROM_THE_FUTURE });
    expect(record(s, { type: 'quizFinished', place: 'mars', firstTryAll: false }, content).quizzes.mars).toEqual({ done: true, perfect: true, tries: [1, 2] });
  });
});

describe('record: every other event', () => {
  const others: GameEvent[] = [
    { type: 'capsuleCollected', capsule: 'light-8-minutes' },
    { type: 'courseFinished', course: 'cadet', timeMs: 40_000, crystals: 3, crystalsTotal: 5, bumps: 1 },
    { type: 'activityFinished', activity: 'lineup', key: 'mars' },
    { type: 'rescueDone', mission: 'rescue-balloon' },
    { type: 'itemEquipped', item: 'paint-mars-red' },
    { type: 'bump' },
    { type: 'boost', on: true },
  ];

  it('returns the same save, unchanged', () => {
    const s = save({ dots: ['mars/rim'], visited: ['mars'] });
    const before = structuredClone(s);
    for (const e of others) expect(record(s, e, content), e.type).toBe(s);
    expect(s).toEqual(before);
  });

  it('only three events are recorded', () => {
    expect(RECORDED_EVENTS).toEqual(['arrived', 'dotFound', 'quizFinished']);
    expect(others.some((e) => (RECORDED_EVENTS as readonly string[]).includes(e.type))).toBe(false);
  });
});

describe('record is pure', () => {
  it('never changes its input, and keeps fields from a newer version at every level', () => {
    const s = migrate(structuredClone(V3_FROM_THE_FUTURE));
    const before = structuredClone(s);
    const after = play(s, { type: 'arrived', place: 'earth' }, dot('mars/rim'), dot('mars/sky'), dot('mars/rover'), { type: 'quizFinished', place: 'mars', firstTryAll: true });
    expect(s).toEqual(before);
    expect(after.pets).toEqual({ comet: { name: 'Zip' } });
    expect(after.theme).toBe('night');
    expect(after.worlds.mars.rings).toBe(2);
    expect(after.courses['ring-run'].ghost).toBe('abc');
  });
});
