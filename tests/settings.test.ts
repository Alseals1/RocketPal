import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  effectiveReducedMotion,
  loadSettings,
  normaliseSettings,
  saveSettings,
  type Settings,
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

/** The defaults with some fields changed. */
const settingsWith = (change: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...change });
const DEFAULT_VOLUME = { effects: 0.8, music: 0.5, voice: 1 };

describe('loadSettings', () => {
  it('uses the defaults when nothing has been saved', () => {
    expect(loadSettings(memoryStorage())).toEqual({
      textSize: 'normal',
      reducedMotion: 'system',
      volume: DEFAULT_VOLUME,
      assist: 'full',
      boost: 'hold',
    });
  });

  it('gives back what was saved', () => {
    const storage = memoryStorage();
    const mine: Settings = {
      textSize: 'huge',
      reducedMotion: 'on',
      volume: { effects: 0, music: 0.25, voice: 0.7 },
      assist: 'little',
      boost: 'toggle',
    };
    saveSettings(mine, storage);
    expect(loadSettings(storage)).toEqual(mine);
  });

  it('loads an old version 1 record with its two values and the new defaults', () => {
    expect(loadSettings(saved({ version: 1, textSize: 'huge', reducedMotion: 'on' }))).toEqual(
      settingsWith({ textSize: 'huge', reducedMotion: 'on' }),
    );
  });

  it('uses the default volumes when the saved volume is not an object', () => {
    for (const volume of [0.5, 'loud', null, [1, 1, 1]]) {
      expect(loadSettings(saved({ textSize: 'big', volume })).volume).toEqual(DEFAULT_VOLUME);
    }
  });

  it('falls back one volume channel at a time', () => {
    for (const bad of [-0.1, 1.5, '1', null, true]) {
      expect(loadSettings(saved({ volume: { effects: bad, music: 0.2, voice: 0 } })).volume).toEqual({
        effects: 0.8,
        music: 0.2,
        voice: 0,
      });
    }
    // JSON cannot hold NaN or Infinity, so check those through normaliseSettings.
    for (const bad of [NaN, Infinity]) {
      expect(normaliseSettings({ volume: { effects: 0.1, music: bad, voice: 1 } }, DEFAULT_SETTINGS).volume).toEqual({
        effects: 0.1,
        music: 0.5,
        voice: 1,
      });
    }
  });

  it('keeps 0 and 1 as good volumes', () => {
    expect(loadSettings(saved({ volume: { effects: 0, music: 1, voice: 0 } })).volume).toEqual({ effects: 0, music: 1, voice: 0 });
  });

  it('falls back alone for a bad assist or boost', () => {
    expect(loadSettings(saved({ textSize: 'big', assist: 'none', boost: 'toggle' }))).toEqual(
      settingsWith({ textSize: 'big', boost: 'toggle' }),
    );
    expect(loadSettings(saved({ assist: 'some', boost: 1 }))).toEqual(settingsWith({ assist: 'some' }));
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
    expect(loadSettings(saved({ textSize: 'gigantic', reducedMotion: 'off' }))).toEqual(settingsWith({ reducedMotion: 'off' }));
    expect(loadSettings(saved({ textSize: 'big', reducedMotion: 7 }))).toEqual(settingsWith({ textSize: 'big' }));
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

describe('normaliseSettings', () => {
  it('keeps the fallback for every bad field', () => {
    const current: Settings = {
      textSize: 'big',
      reducedMotion: 'on',
      volume: { effects: 0.1, music: 0.2, voice: 0.3 },
      assist: 'some',
      boost: 'toggle',
    };
    expect(
      normaliseSettings({ textSize: 'x', reducedMotion: 3, volume: { effects: 2, music: 0.9 }, assist: null, boost: 'press' }, current),
    ).toEqual({ ...current, volume: { effects: 0.1, music: 0.9, voice: 0.3 } });
    expect(normaliseSettings('nonsense', current)).toEqual(current);
  });

  it('does not share the volume object with the fallback', () => {
    const result = normaliseSettings(null, DEFAULT_SETTINGS);
    expect(result.volume).not.toBe(DEFAULT_SETTINGS.volume);
  });
});

describe('saveSettings', () => {
  it('says it saved', () => {
    expect(saveSettings(settingsWith({ textSize: 'big', reducedMotion: 'off' }), memoryStorage())).toBe(true);
  });

  it('does not crash, and says so, when the browser will not let us save', () => {
    const full: SettingsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveSettings(settingsWith({ textSize: 'big' }), full)).toBe(false);
    expect(saveSettings(settingsWith({ textSize: 'big' }), null)).toBe(false);
  });

  it('keeps only the settings (nothing personal) in one small entry', () => {
    const storage = memoryStorage();
    saveSettings(settingsWith({ textSize: 'big', reducedMotion: 'on' }), storage);
    expect(Object.keys(storage.data)).toEqual([SETTINGS_KEY]);
    expect(JSON.parse(storage.data[SETTINGS_KEY])).toEqual({
      version: 2,
      textSize: 'big',
      reducedMotion: 'on',
      volume: DEFAULT_VOLUME,
      assist: 'full',
      boost: 'hold',
    });
  });

  it('writes only the five settings, even if the object carries more', () => {
    const storage = memoryStorage();
    saveSettings({ ...DEFAULT_SETTINGS, extra: 'name' } as Settings, storage);
    expect(Object.keys(JSON.parse(storage.data[SETTINGS_KEY])).sort()).toEqual(
      ['assist', 'boost', 'reducedMotion', 'textSize', 'version', 'volume'],
    );
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
