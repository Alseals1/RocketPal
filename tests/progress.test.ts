import { describe, expect, it } from 'vitest';
import {
  PROGRESS_KEY,
  emptyProgress,
  loadProgress,
  recordMission,
  recordQuiz,
  saveProgress,
  starsFor,
} from '../src/core/progress';

/** A pretend browser storage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}
const withSaved = (value: unknown) => fakeStorage({ [PROGRESS_KEY]: typeof value === 'string' ? value : JSON.stringify(value) });

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
});

describe('saving and loading', () => {
  it('saves only the three yes/no flags per world, under one key, and nothing else', () => {
    const storage = fakeStorage();
    const p = recordQuiz(recordMission(emptyProgress(), 'mars'), 'mars', false);
    expect(saveProgress(p, storage)).toBe(true);
    expect(Object.keys(storage.data)).toEqual(['rocketpals.progress']);
    expect(JSON.parse(storage.data[PROGRESS_KEY])).toEqual({
      version: 1,
      worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: false } },
    });
  });

  it('gets back what was saved', () => {
    const storage = fakeStorage();
    let p = recordMission(emptyProgress(), 'earth');
    p = recordQuiz(recordMission(p, 'mars'), 'mars', true);
    saveProgress(p, storage);
    const loaded = loadProgress(storage);
    expect(starsFor(loaded, 'earth')).toBe(1);
    expect(starsFor(loaded, 'mars')).toBe(3);
    expect(starsFor(loaded, 'moon')).toBe(0);
  });

  it('starts empty when nothing was saved or there is no storage at all', () => {
    expect(starsFor(loadProgress(fakeStorage()), 'mars')).toBe(0);
    expect(starsFor(loadProgress(null), 'mars')).toBe(0);
  });

  it('starts empty, without crashing, when the saved text is garbage', () => {
    for (const bad of ['', 'not json {', 'null', '42', '"hi"', '[]', '{"worlds": 7}', '{"worlds": []}', '{"worlds": null}']) {
      const loaded = loadProgress(withSaved(bad));
      expect(starsFor(loaded, 'mars'), bad).toBe(0);
    }
  });

  it('keeps what is good one field at a time and falls back to "not done" for the rest', () => {
    const loaded = loadProgress(
      withSaved({
        worlds: {
          mars: { missionDone: true, quizDone: 'yes', perfectQuiz: 1 },
          earth: { quizDone: true, perfectQuiz: true, missionDone: false },
          moon: 'nope',
          venus: null,
        },
      }),
    );
    expect(starsFor(loaded, 'mars')).toBe(1); // only the mission flag was a real yes
    expect(starsFor(loaded, 'earth')).toBe(2); // quiz and perfect, mission not done
    expect(starsFor(loaded, 'moon')).toBe(0);
    expect(starsFor(loaded, 'venus')).toBe(0);
  });

  it('drops anything it does not know about, so odd keys never get saved back', () => {
    const storage = withSaved({ worlds: { mars: { missionDone: true, name: 'Sam', score: 99 } }, email: 'x@y.z' });
    const loaded = loadProgress(storage);
    saveProgress(loaded, storage);
    expect(JSON.parse(storage.data[PROGRESS_KEY])).toEqual({
      version: 1,
      worlds: { mars: { missionDone: true, quizDone: false, perfectQuiz: false } },
    });
  });

  it('ignores world names that could be mischief, such as __proto__', () => {
    const loaded = loadProgress(withSaved('{"worlds":{"__proto__":{"missionDone":true},"Mars!":{"missionDone":true},"has space":{"missionDone":true}}}'));
    expect(starsFor(loaded, '__proto__')).toBe(0);
    expect(starsFor(loaded, 'Mars!')).toBe(0);
    expect(starsFor(loaded, 'has space')).toBe(0);
    expect(Object.keys(loaded.worlds)).toEqual([]);
    expect(({} as Record<string, unknown>).missionDone).toBeUndefined(); // the shared Object prototype is untouched
  });

  it('is not fooled by built-in property names: a world called "constructor" or "toString" has no stars until it earns them', () => {
    const p = emptyProgress();
    for (const name of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) expect(starsFor(p, name), name).toBe(0);
    const earned = recordMission(p, 'constructor');
    expect(starsFor(earned, 'constructor')).toBe(1);
    expect(starsFor(earned, 'toString')).toBe(0);
  });

  it('does not crash if the browser refuses to read or write, and says so', () => {
    const angry = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(starsFor(loadProgress(angry), 'mars')).toBe(0);
    expect(saveProgress(recordMission(emptyProgress(), 'mars'), angry)).toBe(false);
    expect(saveProgress(recordMission(emptyProgress(), 'mars'), null)).toBe(false);
  });
});
