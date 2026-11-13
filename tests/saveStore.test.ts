import { describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, PROGRESS_KEY, createSaveStore } from '../src/platform/saveStore';
import { emptySave, type SaveData } from '../src/core/save/schema';
import { recordMission, recordQuiz, starsFor } from './fixtures/worldFlags';
import { emptyProgressV1, oldTabEarnsMission } from './fixtures/progressV1';
import { V1_MARS_3_EARTH_2 } from './fixtures/saves';

/** A pretend browser storage, shared by every "window" given it. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  const storage = {
    data,
    getItem: (k: string) => (Object.hasOwn(data, k) ? data[k] : null),
    setItem: vi.fn((k: string, v: string) => {
      data[k] = v;
    }),
  };
  return storage;
}

/** What a browser does in every other window when one window changes storage. */
const storageEvent = (key: string | null) => Object.assign(new Event('storage'), { key });

const angry = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
};

const stored = (s: ReturnType<typeof fakeStorage>, key = PROGRESS_KEY) => JSON.parse(s.data[key]) as SaveData;

describe('reading', () => {
  it('an empty, missing or refusing storage reads as an empty save, without throwing', () => {
    for (const storage of [fakeStorage(), null, angry]) {
      const store = createSaveStore(storage, null);
      expect(store.read()).toEqual(emptySave());
      expect(store.revision).toBe(0);
    }
  });

  it('a v1 save from today loads with every star', () => {
    const store = createSaveStore(fakeStorage({ [PROGRESS_KEY]: JSON.stringify(V1_MARS_3_EARTH_2) }), null);
    expect(starsFor(store.read(), 'mars')).toBe(3);
    expect(starsFor(store.read(), 'earth')).toBe(2);
  });

  it('gets back what was saved, in a new window', () => {
    const storage = fakeStorage();
    createSaveStore(storage, null).update((s) => recordQuiz(recordMission(recordMission(s, 'earth'), 'mars'), 'mars', true));
    const loaded = createSaveStore(storage, null).read();
    expect(starsFor(loaded, 'earth')).toBe(1);
    expect(starsFor(loaded, 'mars')).toBe(3);
    expect(starsFor(loaded, 'moon')).toBe(0);
  });

  it('starts empty, without throwing, when the saved text is garbage', () => {
    for (const bad of ['', 'not json {', 'null', '42', '"hi"', '[]', '{"worlds": 7}', '{"worlds": []}', '{"worlds": null}']) {
      const store = createSaveStore(fakeStorage({ [PROGRESS_KEY]: bad, [BACKUP_KEY]: bad }), null);
      expect(store.read(), bad).toEqual(emptySave());
    }
  });

  it('garbage in either key starts empty for that key only', () => {
    const storage = fakeStorage({ [PROGRESS_KEY]: 'not json {', [BACKUP_KEY]: JSON.stringify(V1_MARS_3_EARTH_2) });
    expect(starsFor(createSaveStore(storage, null).read(), 'mars')).toBe(3);
  });
});

describe('saving', () => {
  it('writes the same v2 record to the progress key and its backup, and nothing else', () => {
    const storage = fakeStorage();
    const store = createSaveStore(storage, null);
    const changes: SaveData[] = [];
    store.onChange((s) => changes.push(s));
    const result = store.update((s) => recordQuiz(recordMission(s, 'mars'), 'mars', false));

    expect(Object.keys(storage.data).sort()).toEqual([PROGRESS_KEY, BACKUP_KEY].sort());
    expect(storage.data[PROGRESS_KEY]).toBe(storage.data[BACKUP_KEY]);
    expect(stored(storage)).toEqual({ ...emptySave(), worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: false } } });
    expect(result).toEqual(stored(storage));
    expect(store.read()).toEqual(result);
    expect(store.revision).toBe(1);
    expect(changes).toEqual([result]);
  });

  it('an update that changes nothing does not count as a change', () => {
    const store = createSaveStore(fakeStorage(), null);
    const fn = vi.fn();
    store.onChange(fn);
    store.update((s) => recordMission(s, 'mars'));
    store.update((s) => recordMission(s, 'mars'));
    store.update((s) => s);
    expect(store.revision).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a change can never take anything away', () => {
    const store = createSaveStore(fakeStorage(), null);
    store.update((s) => ({ ...recordMission(s, 'mars'), dots: ['mars:rim'] }));
    const after = store.update(() => emptySave());
    expect(starsFor(after, 'mars')).toBe(1);
    expect(after.dots).toEqual(['mars:rim']);
  });

  it('when the browser will not store anything, the game still works in memory for the visit', () => {
    for (const storage of [null, angry]) {
      const store = createSaveStore(storage, null);
      const s = store.update((x) => recordQuiz(recordMission(x, 'mars'), 'mars', true));
      expect(starsFor(s, 'mars')).toBe(3);
      expect(starsFor(store.read(), 'mars')).toBe(3);
      expect(store.revision).toBe(1);
    }
  });

  it('when storage is full (writing throws), the new save is still returned and kept in memory', () => {
    const storage = fakeStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const store = createSaveStore(storage, null);
    expect(starsFor(store.update((s) => recordMission(s, 'earth')), 'earth')).toBe(1);
    expect(starsFor(store.read(), 'earth')).toBe(1);
  });
});

describe('two windows open at once', () => {
  it('the second one saving never undoes the first one\'s stars (through storage, as today)', () => {
    const storage = fakeStorage();
    const a = createSaveStore(storage, null); // window A starts out knowing nothing
    const b = createSaveStore(storage, null);
    b.update((s) => recordQuiz(recordMission(s, 'mars'), 'mars', true)); // B earns three stars on Mars
    a.update((s) => recordMission(s, 'earth')); // A, with its old picture, earns the Earth mission
    const after = createSaveStore(storage, null).read();
    expect(starsFor(after, 'mars')).toBe(3);
    expect(starsFor(after, 'earth')).toBe(1);
    expect(starsFor(a.read(), 'mars')).toBe(3); // and A itself now knows too
  });

  it('a change in another window shows up here through the storage event, without this window writing', () => {
    const storage = fakeStorage();
    const events = new EventTarget();
    const a = createSaveStore(storage, events);
    const b = createSaveStore(storage, null);
    const seen: SaveData[] = [];
    a.onChange((s) => seen.push(s));

    b.update((s) => recordQuiz(recordMission(s, 'mars'), 'mars', true));
    storage.setItem.mockClear();
    events.dispatchEvent(storageEvent(PROGRESS_KEY));

    expect(seen).toHaveLength(1);
    expect(starsFor(seen[0], 'mars')).toBe(3);
    expect(starsFor(a.read(), 'mars')).toBe(3);
    expect(a.revision).toBe(1);
    expect(storage.setItem).not.toHaveBeenCalled(); // never answers back, so two windows cannot ping-pong
  });

  it('reacts to the backup key and to a cleared storage too, but ignores other keys and events with nothing new', () => {
    const storage = fakeStorage();
    const events = new EventTarget();
    const a = createSaveStore(storage, events);
    const fn = vi.fn();
    a.onChange(fn);

    createSaveStore(storage, null).update((s) => recordMission(s, 'mars'));
    events.dispatchEvent(storageEvent('rocketpals.settings'));
    expect(fn).not.toHaveBeenCalled();
    events.dispatchEvent(storageEvent(BACKUP_KEY));
    expect(fn).toHaveBeenCalledTimes(1);
    events.dispatchEvent(storageEvent(PROGRESS_KEY)); // nothing new since
    events.dispatchEvent(storageEvent(null));
    expect(fn).toHaveBeenCalledTimes(1);

    createSaveStore(storage, null).update((s) => recordMission(s, 'earth'));
    events.dispatchEvent(storageEvent(null)); // storage.clear() in another window gives a null key
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops listening after dispose, and an unsubscribe works', () => {
    const storage = fakeStorage();
    const events = new EventTarget();
    const a = createSaveStore(storage, events);
    const kept = vi.fn();
    const dropped = vi.fn();
    a.onChange(kept);
    const off = a.onChange(dropped);
    off();

    createSaveStore(storage, null).update((s) => recordMission(s, 'mars'));
    events.dispatchEvent(storageEvent(PROGRESS_KEY));
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();

    a.dispose();
    createSaveStore(storage, null).update((s) => recordMission(s, 'earth'));
    events.dispatchEvent(storageEvent(PROGRESS_KEY));
    expect(kept).toHaveBeenCalledTimes(1);
  });
});

describe('a tab still running the old (v1) save code', () => {
  it('never wipes 2.0 progress, even when no new window is open while it saves', () => {
    const storage = fakeStorage();
    // A new window saves 2.0 progress, including a field from an even newer version, then is closed.
    createSaveStore(storage, null).update((s) => ({ ...recordMission(s, 'mars'), dots: ['mars:rim'], fromTheFuture: { x: 1 } }));

    // The old tab earns the Venus mission and saves the old way: the progress key now holds only v1 flags.
    oldTabEarnsMission(storage, emptyProgressV1(), 'venus');
    expect(Object.keys(stored(storage))).toEqual(['version', 'worlds']);

    // A new window opens: everything is there.
    const store = createSaveStore(storage, null);
    const s = store.read();
    expect(s.dots).toEqual(['mars:rim']);
    expect(s.fromTheFuture).toEqual({ x: 1 });
    expect(starsFor(s, 'mars')).toBe(1);
    expect(starsFor(s, 'venus')).toBe(1);

    // Its first save puts all of it back under both keys.
    store.update((x) => recordMission(x, 'earth'));
    for (const key of [PROGRESS_KEY, BACKUP_KEY]) {
      const saved = stored(storage, key);
      expect(saved.version).toBe(2);
      expect(saved.dots).toEqual(['mars:rim']);
      expect(saved.fromTheFuture).toEqual({ x: 1 });
      expect(['mars', 'venus', 'earth'].map((id) => starsFor(saved, id))).toEqual([1, 1, 1]);
    }
  });
});
