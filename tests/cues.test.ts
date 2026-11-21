import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUED_EVENTS, SOUND_IDS, eventCue, rewardCue } from '../src/core/cues';
import type { GameEvent } from '../src/core/events';
import type { RewardDiff } from '../src/core/progression';

const noReward: RewardDiff = { xpGained: 0, newStars: [], newPatches: [], newItems: [], newPages: [], missionsDone: [], chaptersDone: [] };

/** One of every event type, with each sound-making variant. */
const EVERY_EVENT: GameEvent[] = [
  { type: 'arrived', place: 'mars' },
  { type: 'dotFound', dot: 'mars/rim' },
  { type: 'quizFinished', place: 'mars', firstTryAll: true },
  { type: 'capsuleCollected', capsule: 'light-8-minutes' },
  { type: 'courseFinished', course: 'belt-cadet', timeMs: 1000, crystals: 1, crystalsTotal: 2, bumps: 0 },
  { type: 'activityFinished', activity: 'belt-run' },
  { type: 'rescueDone', mission: 'rescue-balloon' },
  { type: 'itemEquipped', item: 'paint-mars-red' },
  { type: 'bump' },
  { type: 'boost', on: true },
  { type: 'boost', on: false },
  { type: 'answered', place: 'mars', correct: true },
  { type: 'answered', place: 'mars', correct: false },
];

describe('eventCue', () => {
  it('gives each event its sound', () => {
    expect(EVERY_EVENT.map((e) => [e.type, 'on' in e ? e.on : 'correct' in e ? e.correct : '', eventCue(e) ?? null])).toEqual([
      ['arrived', '', 'docking'],
      ['dotFound', '', 'dot-found'],
      ['quizFinished', '', null],
      ['capsuleCollected', '', 'capsule'],
      ['courseFinished', '', null],
      ['activityFinished', '', null],
      ['rescueDone', '', null],
      ['itemEquipped', '', null],
      ['bump', '', 'bump'],
      ['boost', true, 'boost'],
      ['boost', false, null],
      ['answered', true, 'right'],
      ['answered', false, 'not-quite'],
    ]);
  });

  it('lists in CUED_EVENTS exactly the event types that can make a sound', () => {
    const sounding = new Set(EVERY_EVENT.filter((e) => eventCue(e) !== undefined).map((e) => e.type));
    expect([...CUED_EVENTS].sort()).toEqual([...sounding].sort());
  });
});

describe('rewardCue', () => {
  const star = { ...noReward, newStars: [{ place: 'mars', count: 1 }] };
  const patch = { ...star, newPatches: ['first-flight'] };
  const rank = { ...patch, rankUp: { from: 1, to: 2 } };

  it('plays the biggest reward: a rank, then a patch, then a star', () => {
    expect(rewardCue(rank)).toBe('rank-up');
    expect(rewardCue(patch)).toBe('patch');
    expect(rewardCue(star)).toBe('star');
    expect(rewardCue({ ...noReward, rankUp: { from: 1, to: 2 } })).toBe('rank-up');
    expect(rewardCue({ ...noReward, newPatches: ['x'] })).toBe('patch');
  });

  it('gives nothing for XP, pages, missions or items alone (the event plays its own sound)', () => {
    expect(rewardCue(noReward)).toBeUndefined();
    expect(rewardCue({ ...noReward, xpGained: 5, newPages: ['mars/rim'], missionsDone: ['find-3-mars'], newItems: ['x'] })).toBeUndefined();
  });
});

describe('every cue names a sound in sounds.json', () => {
  const ids = (JSON.parse(readFileSync('public/data/sounds.json', 'utf8')) as { sounds: { id: string }[] }).sounds.map((s) => s.id);

  it('SOUND_IDS are exactly the sounds in the file', () => {
    expect([...SOUND_IDS].sort()).toEqual([...ids].sort());
  });

  it('every sound a cue can give is there', () => {
    const given = new Set<string>();
    for (const e of EVERY_EVENT) {
      const id = eventCue(e);
      if (id) given.add(id);
    }
    for (const d of [{ ...noReward, rankUp: { from: 1, to: 2 } }, { ...noReward, newPatches: ['p'] }, { ...noReward, newStars: [{ place: 'mars', count: 1 }] }]) {
      given.add(rewardCue(d)!);
    }
    for (const id of given) expect(ids, id).toContain(id);
    expect(given.size).toBe(SOUND_IDS.length);
  });
});
