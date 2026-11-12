import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings, type SettingsStorage } from '../src/core/settings';
import { createSettingsStore } from '../src/platform/settingsStore';

function memoryStorage(initial: Record<string, string> = {}): SettingsStorage & { data: Record<string, string>; writes: number } {
  const store = {
    data: { ...initial },
    writes: 0,
    getItem: (key: string) => (key in store.data ? store.data[key] : null),
    setItem: (key: string, value: string) => {
      store.writes++;
      store.data[key] = value;
    },
  };
  return store;
}

const stored = (storage: { data: Record<string, string> }) => JSON.parse(storage.data[SETTINGS_KEY]);

describe('createSettingsStore', () => {
  it('starts with the defaults when nothing is saved', () => {
    expect(createSettingsStore(memoryStorage()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it("reads an old version 1 record's values", () => {
    const storage = memoryStorage({ [SETTINGS_KEY]: JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'on' }) });
    expect(createSettingsStore(storage).get()).toEqual({ ...DEFAULT_SETTINGS, textSize: 'huge', reducedMotion: 'on' });
  });

  it('merges a change, saves it, returns it and tells listeners', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    const heard: Settings[] = [];
    store.onChange((s) => heard.push(s));

    const next = store.set({ textSize: 'big' });

    expect(next).toEqual({ ...DEFAULT_SETTINGS, textSize: 'big' });
    expect(store.get()).toEqual(next);
    expect(stored(storage)).toEqual({ version: 2, ...next });
    expect(heard).toEqual([next]);
  });

  it('accepts a whole new volume', () => {
    const store = createSettingsStore(memoryStorage());
    expect(store.set({ volume: { effects: 0, music: 0.1, voice: 0.2 } }).volume).toEqual({ effects: 0, music: 0.1, voice: 0.2 });
  });

  it('does not call a listener after it unsubscribes', () => {
    const store = createSettingsStore(memoryStorage());
    const fn = vi.fn();
    const off = store.onChange(fn);
    off();
    store.set({ textSize: 'huge' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not write or notify when nothing changes', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    const fn = vi.fn();
    store.onChange(fn);
    store.set({ textSize: 'normal', volume: { ...DEFAULT_SETTINGS.volume } });
    store.set({});
    expect(fn).not.toHaveBeenCalled();
    expect(storage.writes).toBe(0);
  });

  it('keeps the current value when a change is bad', () => {
    const store = createSettingsStore(memoryStorage());
    store.set({ textSize: 'big', assist: 'some' });
    const bad = { textSize: 'gigantic', assist: 'none', volume: { effects: 3, music: 0.4, voice: -1 } } as unknown as Partial<Settings>;
    expect(store.set(bad)).toEqual({ ...DEFAULT_SETTINGS, textSize: 'big', assist: 'some', volume: { effects: 0.8, music: 0.4, voice: 1 } });
  });

  it('works in memory, and never throws, when storage throws', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createSettingsStore(broken);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(() => store.set({ reducedMotion: 'off' })).not.toThrow();
    expect(store.get().reducedMotion).toBe('off');
  });

  it('works in memory with no storage at all', () => {
    const store = createSettingsStore(null);
    const fn = vi.fn();
    store.onChange(fn);
    store.set({ boost: 'toggle' });
    expect(store.get().boost).toBe('toggle');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hands out copies, so changing one does not change the store', () => {
    const store = createSettingsStore(memoryStorage());
    const copy = store.get();
    copy.textSize = 'huge';
    copy.volume.music = 0;
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('lets a listener unsubscribe while being told, without skipping others', () => {
    const store = createSettingsStore(memoryStorage());
    const second = vi.fn();
    const off = store.onChange(() => off());
    store.onChange(second);
    store.set({ textSize: 'big' });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
