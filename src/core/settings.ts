export type TextSize = 'normal' | 'big' | 'huge';
/** "system" follows the computer's own reduced-motion setting. */
export type MotionChoice = 'system' | 'on' | 'off';

/** How loud each sound channel is, from 0 (off) to 1 (full). */
export interface VolumeSettings {
  effects: number;
  music: number;
  voice: number;
}
/** How much the flight helps on a course (GAME_DESIGN.md section 13). */
export type Assist = 'full' | 'some' | 'little';
/** Hold the boost key or button, or tap it to switch boost on and off (#56 adds toggle). */
export type BoostMode = 'hold' | 'toggle';

/** The player's settings (docs/TECHNICAL_ARCHITECTURE.md 4.15). */
export interface Settings {
  textSize: TextSize;
  reducedMotion: MotionChoice;
  volume: VolumeSettings;
  assist: Assist;
  boost: BoostMode;
}

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'normal',
  reducedMotion: 'system',
  volume: { effects: 0.8, music: 0.5, voice: 1 },
  assist: 'full',
  boost: 'hold',
};
export const SETTINGS_KEY = 'rocketpals.settings';
/** Version 1 had only textSize and reducedMotion. Version 2 adds volume, assist and boost. */
const VERSION = 2;

export const TEXT_SIZES: TextSize[] = ['normal', 'big', 'huge'];
export const MOTION_CHOICES: MotionChoice[] = ['system', 'on', 'off'];
export const ASSIST_CHOICES: Assist[] = ['full', 'some', 'little'];
export const BOOST_MODES: BoostMode[] = ['hold', 'toggle'];
const VOLUME_CHANNELS = ['effects', 'music', 'voice'] as const satisfies readonly (keyof VolumeSettings)[];

/** The two things we use from the browser's storage, so tests can pass in a pretend one. */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's storage, or null if the browser will not give it to us (private mode, school rules). */
export function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads the saved settings. Anything missing or wrong falls back to the default, one setting at a time. */
export function loadSettings(storage: SettingsStorage | null): Settings {
  let raw: unknown;
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    return normaliseSettings(null, DEFAULT_SETTINGS);
  }
  return normaliseSettings(raw, DEFAULT_SETTINGS);
}

/**
 * Turns anything into good settings: each field (and each volume channel) that is missing or wrong takes the value
 * from `fallback`. Loading uses the defaults as the fallback; the settings store uses the current settings, so a bad
 * change keeps what was there.
 */
export function normaliseSettings(raw: unknown, fallback: Settings): Settings {
  const saved = isRecord(raw) ? raw : {};
  return {
    textSize: TEXT_SIZES.find((s) => s === saved.textSize) ?? fallback.textSize,
    reducedMotion: MOTION_CHOICES.find((m) => m === saved.reducedMotion) ?? fallback.reducedMotion,
    volume: normaliseVolume(saved.volume, fallback.volume),
    assist: ASSIST_CHOICES.find((a) => a === saved.assist) ?? fallback.assist,
    boost: BOOST_MODES.find((b) => b === saved.boost) ?? fallback.boost,
  };
}

function normaliseVolume(raw: unknown, fallback: VolumeSettings): VolumeSettings {
  const saved = isRecord(raw) ? raw : {};
  const volume = { ...fallback };
  for (const channel of VOLUME_CHANNELS) {
    const v = saved[channel];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) volume[channel] = v;
  }
  return volume;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** True when two settings are the same in every field. */
export function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.textSize === b.textSize &&
    a.reducedMotion === b.reducedMotion &&
    a.assist === b.assist &&
    a.boost === b.boost &&
    VOLUME_CHANNELS.every((c) => a.volume[c] === b.volume[c])
  );
}

/** Saves the settings. Returns false (and never throws) if the browser will not let us. */
export function saveSettings(settings: Settings, storage: SettingsStorage | null): boolean {
  try {
    if (!storage) return false;
    const { textSize, reducedMotion, volume, assist, boost } = settings;
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: VERSION, textSize, reducedMotion, volume, assist, boost }));
    return true;
  } catch {
    return false;
  }
}

const SCALES: Record<TextSize, number> = { normal: 1, big: 1.25, huge: 1.5 };

/** How many times bigger than normal the text should be. */
export function textScale(size: TextSize): number {
  return SCALES[size];
}

/** Whether to cut down motion: the player's own choice wins over the computer's. */
export function effectiveReducedMotion(choice: MotionChoice, systemPrefersReduced: boolean): boolean {
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return systemPrefersReduced;
}
