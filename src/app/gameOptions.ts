import type { SettingsStore } from '../platform/settingsStore';
import type { Quality } from '../quality/quality';

/** What `main.ts` hands the game when it starts, next to the content. */
export interface GameOptions {
  /** 'high' or 'low' from the page address, to force a quality (and turn off the automatic chooser). */
  forcedQuality?: Quality;
  touchControls: boolean;
  settings: SettingsStore;
  debug: boolean;
}
