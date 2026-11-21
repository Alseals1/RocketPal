/**
 * Read-aloud, as the UI sees it. The type lives in the logic layer, like `Settings`, so UI code can take a speaker
 * without importing the platform code that drives the browser's voice (`src/audio/speech.ts`).
 * See decisions/2026-11-21-sound-effects-and-listen.md.
 */
export interface Speaker {
  /** False on a computer or browser with no reading voice. */
  isSupported(): boolean;
  isSpeaking(): boolean;
  /**
   * Starts reading. Anything already being read stops first, and its `onEnd` runs then, so its button goes back to
   * "Listen". `onEnd` runs when this reading finishes or is stopped.
   */
  speak(text: string, onEnd?: () => void): void;
  stop(): void;
  /** Forgets an earlier failure to start, so the next reading gets a fresh try. */
  reset(): void;
  /** How loud the reading voice is, from 0 to 1 (Settings, Reading voice). Applies from the next reading. */
  setVolume(v: number): void;
}
