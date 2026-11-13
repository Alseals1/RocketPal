/**
 * The player's settings, kept in the browser (docs/TECHNICAL_ARCHITECTURE.md 4.15). Platform layer: it touches the
 * browser's storage. The `Settings` type, the defaults and the format live in `src/core/settings.ts`, because the
 * UI reads them and UI may not import Platform (the same split as `SaveData` and `SaveStore`).
 * See decisions/2026-11-12-platform-services.md.
 */
import { loadSettings, normaliseSettings, sameSettings, saveSettings, type Settings, type SettingsStorage } from '../core/settings';

export type { Settings } from '../core/settings';

export interface SettingsStore {
  get(): Settings;
  /** Applies a change and saves it. A bad value keeps the current one. Returns the new settings. */
  set(change: Partial<Settings>): Settings;
  /** Called after each change that made a difference. Returns an unsubscribe. */
  onChange(fn: (s: Settings) => void): () => void;
}

/** A settings store over the given storage. With no storage (blocked by the browser) it works in memory for the visit. */
export function createSettingsStore(storage: SettingsStorage | null): SettingsStore {
  let current = loadSettings(storage);
  const listeners = new Set<(s: Settings) => void>();
  const copy = (s: Settings): Settings => ({ ...s, volume: { ...s.volume } });

  return {
    get: () => copy(current),
    set(change) {
      const next = normaliseSettings({ ...current, ...change }, current);
      if (sameSettings(next, current)) return copy(current);
      saveSettings(next, storage); // false means memory only, which is fine
      current = next;
      for (const fn of [...listeners]) fn(copy(current));
      return copy(current);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
