export type Quality = 'high' | 'low';

export interface HardwareHints {
  /** navigator.deviceMemory (GB), if the browser says. */
  deviceMemory?: number;
  /** navigator.hardwareConcurrency, if the browser says. */
  hardwareConcurrency?: number;
}

export interface QualitySettings {
  glow: boolean;
  shadows: boolean;
  starCount: number;
  /** Highest devicePixelRatio to render at. */
  pixelRatioCap: number;
}

/** Below this many frames per second we switch to low quality. */
const LOW_FPS = 40;
/** How many frame times we need before judging. */
const MIN_SAMPLES = 30;

export function initialQuality(hints: HardwareHints): Quality {
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= 2) return 'low';
  if (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= 2) return 'low';
  return 'high';
}

/**
 * Decides the quality from recent frame times (milliseconds). Uses the middle value,
 * so one hitch does not matter. Once low, it stays low so the picture never flickers.
 */
export function chooseQuality(frameMs: number[], current: Quality): Quality {
  if (current === 'low') return 'low';
  if (frameMs.length < MIN_SAMPLES) return current;
  const sorted = [...frameMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median > 1000 / LOW_FPS ? 'low' : 'high';
}

export function qualitySettings(quality: Quality): QualitySettings {
  return quality === 'low'
    ? { glow: false, shadows: false, starCount: 600, pixelRatioCap: 1 }
    : { glow: true, shadows: true, starCount: 2500, pixelRatioCap: 2 };
}
