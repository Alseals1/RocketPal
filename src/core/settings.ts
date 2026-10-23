export type TextSize = 'normal' | 'big' | 'huge';
/** "system" follows the computer's own reduced-motion setting. */
export type MotionChoice = 'system' | 'on' | 'off';

export interface Settings {
  textSize: TextSize;
  reducedMotion: MotionChoice;
}

export const DEFAULT_SETTINGS: Settings = { textSize: 'normal', reducedMotion: 'system' };
export const SETTINGS_KEY = 'rocketpals.settings';
const VERSION = 1;

export const TEXT_SIZES: TextSize[] = ['normal', 'big', 'huge'];
export const MOTION_CHOICES: MotionChoice[] = ['system', 'on', 'off'];

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
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  const saved = raw as Record<string, unknown>;
  return {
    textSize: TEXT_SIZES.find((s) => s === saved.textSize) ?? DEFAULT_SETTINGS.textSize,
    reducedMotion: MOTION_CHOICES.find((m) => m === saved.reducedMotion) ?? DEFAULT_SETTINGS.reducedMotion,
  };
}

/** Saves the settings. Returns false (and never throws) if the browser will not let us. */
export function saveSettings(settings: Settings, storage: SettingsStorage | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify({ version: VERSION, ...settings }));
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
