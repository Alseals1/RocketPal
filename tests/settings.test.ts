import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  effectiveReducedMotion,
  loadSettings,
  saveSettings,
  textScale,
  type SettingsStorage,
} from '../src/core/settings';

/** A pretend browser storage that lives in memory. */
function memoryStorage(initial: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const saved = (value: unknown) => memoryStorage({ [SETTINGS_KEY]: JSON.stringify(value) });

describe('loadSettings', () => {
  it('uses the defaults when nothing has been saved', () => {
    expect(loadSettings(memoryStorage())).toEqual({ textSize: 'normal', reducedMotion: 'system' });
  });

  it('gives back what was saved', () => {
    const storage = memoryStorage();
    saveSettings({ textSize: 'huge', reducedMotion: 'on' }, storage);
    expect(loadSettings(storage)).toEqual({ textSize: 'huge', reducedMotion: 'on' });
  });

  it('uses the defaults when the saved text is not even JSON', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{oops' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('uses the defaults when the saved value is not an object', () => {
    expect(loadSettings(saved('big'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(saved(null))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(saved([1, 2]))).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores an unknown or wrong-type value, but keeps the other good one', () => {
    expect(loadSettings(saved({ textSize: 'gigantic', reducedMotion: 'off' }))).toEqual({
      textSize: 'normal',
      reducedMotion: 'off',
    });
    expect(loadSettings(saved({ textSize: 'big', reducedMotion: 7 }))).toEqual({
      textSize: 'big',
      reducedMotion: 'system',
    });
  });

  it('works when the browser will not let us read storage', () => {
    const blocked: SettingsStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
  });

  it('works when there is no storage at all', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('saveSettings', () => {
  it('says it saved', () => {
    expect(saveSettings({ textSize: 'big', reducedMotion: 'off' }, memoryStorage())).toBe(true);
  });

  it('does not crash, and says so, when the browser will not let us save', () => {
    const full: SettingsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveSettings({ textSize: 'big', reducedMotion: 'off' }, full)).toBe(false);
    expect(saveSettings({ textSize: 'big', reducedMotion: 'off' }, null)).toBe(false);
  });

  it('keeps only the settings (nothing personal) in one small entry', () => {
    const storage = memoryStorage();
    saveSettings({ textSize: 'big', reducedMotion: 'on' }, storage);
    expect(Object.keys(storage.data)).toEqual([SETTINGS_KEY]);
    expect(JSON.parse(storage.data[SETTINGS_KEY])).toEqual({ version: 1, textSize: 'big', reducedMotion: 'on' });
  });
});

describe('textScale', () => {
  it('makes text 1x, 1.25x, or 1.5x as big', () => {
    expect(textScale('normal')).toBe(1);
    expect(textScale('big')).toBe(1.25);
    expect(textScale('huge')).toBe(1.5);
  });
});

describe('effectiveReducedMotion', () => {
  it('follows the computer when set to "same as my computer"', () => {
    expect(effectiveReducedMotion('system', true)).toBe(true);
    expect(effectiveReducedMotion('system', false)).toBe(false);
  });

  it('is on when the player turns it on, whatever the computer says', () => {
    expect(effectiveReducedMotion('on', false)).toBe(true);
    expect(effectiveReducedMotion('on', true)).toBe(true);
  });

  it('is off when the player turns it off, even if the computer asks for less motion', () => {
    expect(effectiveReducedMotion('off', true)).toBe(false);
    expect(effectiveReducedMotion('off', false)).toBe(false);
  });
});
