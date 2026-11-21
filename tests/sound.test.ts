import { describe, expect, it } from 'vitest';
import { REPEAT_GAP_MS, connectSound } from '../src/app/sound';
import { createEventBus, type GameEvent } from '../src/core/events';
import type { RewardDiff } from '../src/core/progression';

const noReward: RewardDiff = { xpGained: 0, newStars: [], newPatches: [], newItems: [], newPages: [], missionsDone: [], chaptersDone: [] };

/** A bus, a pretend recorder that reports the diff it is told to, a pretend audio and toaster, and a clock. */
function setup() {
  const events = createEventBus();
  const recorded: ((e: GameEvent, d: RewardDiff) => void)[] = [];
  const played: string[] = [];
  const toasts: string[] = [];
  let time = 0;
  const dispose = connectSound({
    events,
    onRecorded: (fn) => {
      recorded.push(fn);
      return () => recorded.splice(recorded.indexOf(fn), 1);
    },
    audio: { play: (id) => played.push(id) },
    toast: (m) => toasts.push(m),
    rankName: (rank) => ['Cadet', 'Junior Pilot', 'Pilot', 'Navigator', 'Explorer'][rank - 1],
    now: () => time,
  });
  const record = (e: GameEvent, diff: RewardDiff = noReward) => recorded.forEach((fn) => fn(e, diff));
  const wait = (ms: number) => (time += ms);
  return { events, record, played, toasts, dispose, wait };
}

describe('connectSound', () => {
  it("plays an event's own sound", () => {
    const { events, record, played, wait } = setup();
    record({ type: 'dotFound', dot: 'mars/rim' });
    wait(200);
    record({ type: 'arrived', place: 'mars' });
    events.emit({ type: 'answered', place: 'mars', correct: true });
    events.emit({ type: 'answered', place: 'mars', correct: false });
    events.emit({ type: 'boost', on: true });
    events.emit({ type: 'boost', on: false });
    events.emit({ type: 'bump' });
    events.emit({ type: 'capsuleCollected', capsule: 'c' });
    expect(played).toEqual(['dot-found', 'docking', 'right', 'not-quite', 'boost', 'bump', 'capsule']);
  });

  it('does not play recorded events from the bus itself (only once they are recorded)', () => {
    const { events, played } = setup();
    events.emit({ type: 'dotFound', dot: 'mars/rim' });
    events.emit({ type: 'arrived', place: 'mars' });
    expect(played).toEqual([]);
  });

  it('plays the reward sound instead of the event sound', () => {
    const { record, played, wait } = setup();
    record({ type: 'dotFound', dot: 'mars/rover' }, { ...noReward, newStars: [{ place: 'mars', count: 1 }] });
    wait(200);
    record({ type: 'quizFinished', place: 'mars', firstTryAll: false }, noReward); // a replay that earned nothing
    record({ type: 'quizFinished', place: 'mars', firstTryAll: true }, { ...noReward, rankUp: { from: 1, to: 2 }, newStars: [{ place: 'mars', count: 3 }] });
    expect(played).toEqual(['star', 'rank-up']);
  });

  it('shows a toast for a rank-up and for a new patch', () => {
    const { record, toasts } = setup();
    record({ type: 'quizFinished', place: 'mars', firstTryAll: true }, { ...noReward, rankUp: { from: 1, to: 2 } });
    record({ type: 'quizFinished', place: 'earth', firstTryAll: true }, { ...noReward, rankUp: { from: 4, to: 5 }, newPatches: ['first-flight'] });
    expect(toasts).toEqual(['Rank up! You are a Junior Pilot now.', 'Rank up! You are an Explorer now.', 'You earned a new patch!']);
  });

  it(`plays the same sound once within ${REPEAT_GAP_MS} ms, and again after`, () => {
    const { events, played, wait } = setup();
    events.emit({ type: 'boost', on: true });
    wait(REPEAT_GAP_MS - 1);
    events.emit({ type: 'boost', on: true });
    events.emit({ type: 'bump' }); // another sound is not held back
    wait(1);
    events.emit({ type: 'boost', on: true });
    expect(played).toEqual(['boost', 'bump', 'boost']);
  });

  it('plays nothing after dispose', () => {
    const { events, record, played, toasts, dispose } = setup();
    dispose();
    events.emit({ type: 'boost', on: true });
    record({ type: 'dotFound', dot: 'mars/rim' }, { ...noReward, rankUp: { from: 1, to: 2 } });
    expect(played).toEqual([]);
    expect(toasts).toEqual([]);
  });
});
