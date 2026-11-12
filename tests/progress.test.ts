import { describe, expect, it } from 'vitest';
import { emptyProgress, recordMission, recordQuiz, starsFor } from '../src/core/progress';
import { emptySave, migrate } from '../src/core/save/schema';
import { V3_FROM_THE_FUTURE } from './fixtures/saves';

// Loading, saving, garbage, odd names and two windows are tested on the save format and the store:
// tests/saveSchema.test.ts and tests/saveStore.test.ts.

describe('stars', () => {
  it('a new player has no stars anywhere', () => {
    const p = emptyProgress();
    expect(starsFor(p, 'mars')).toBe(0);
    expect(starsFor(p, 'earth')).toBe(0);
    expect(starsFor(p, 'a-world-nobody-has-heard-of')).toBe(0);
  });

  it('gives one star for the mission, one for finishing the quiz and one bonus for a perfect quiz', () => {
    let p = emptyProgress();
    p = recordMission(p, 'mars');
    expect(starsFor(p, 'mars')).toBe(1);
    p = recordQuiz(p, 'mars', false);
    expect(starsFor(p, 'mars')).toBe(2);
    p = recordQuiz(p, 'mars', true);
    expect(starsFor(p, 'mars')).toBe(3);
  });

  it('keeps worlds separate', () => {
    const p = recordMission(emptyProgress(), 'mars');
    expect(starsFor(p, 'mars')).toBe(1);
    expect(starsFor(p, 'earth')).toBe(0);
  });

  it('never takes a star away: a worse replay and repeated records change nothing', () => {
    let p = recordMission(emptyProgress(), 'earth');
    p = recordQuiz(p, 'earth', true);
    expect(starsFor(p, 'earth')).toBe(3);
    p = recordQuiz(p, 'earth', false); // replayed badly
    p = recordQuiz(p, 'earth', false);
    p = recordMission(p, 'earth');
    expect(starsFor(p, 'earth')).toBe(3);
  });

  it('a perfect quiz can be earned on a later replay', () => {
    let p = recordQuiz(recordMission(emptyProgress(), 'earth'), 'earth', false);
    expect(starsFor(p, 'earth')).toBe(2);
    p = recordQuiz(p, 'earth', true);
    expect(starsFor(p, 'earth')).toBe(3);
  });

  it('does not change the progress it was given', () => {
    const before = emptyProgress();
    const snapshot = JSON.stringify(before);
    recordMission(before, 'mars');
    recordQuiz(before, 'mars', true);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('is not fooled by built-in property names: a world called "constructor" or "toString" has no stars until it earns them', () => {
    const p = emptyProgress();
    for (const name of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) expect(starsFor(p, name), name).toBe(0);
    const earned = recordMission(p, 'constructor');
    expect(starsFor(earned, 'constructor')).toBe(1);
    expect(starsFor(earned, 'toString')).toBe(0);
  });
});

describe('recording on a whole save', () => {
  it('keeps every other field, other worlds, and fields from a newer version', () => {
    const future = migrate(V3_FROM_THE_FUTURE);
    const after = recordQuiz(recordMission(future, 'earth'), 'mars', true);
    expect(starsFor(after, 'earth')).toBe(1);
    expect(after.worlds.mars).toEqual({ missionDone: true, quizDone: true, perfectQuiz: true, rings: 2 });
    expect(after.pets).toEqual(future.pets);
    expect(after.courses).toBe(future.courses);
    expect(after.version).toBe(2);
  });

  it('works on an empty v2 save and does not change it', () => {
    const before = emptySave();
    const snapshot = JSON.stringify(before);
    expect(starsFor(recordMission(before, 'venus'), 'venus')).toBe(1);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
