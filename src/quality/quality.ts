import type { SurfaceKind } from '../data/surfaces';

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

/**
 * A device at or under either limit starts on low: a typical school Chromebook has 4 GB and 4 cores (#31).
 * Defaults until a person measures on a Chromebook (docs/CHROMEBOOK_MEASUREMENT.md); see
 * decisions/2026-11-12-renderer-host-and-quality.md.
 */
export const LOW_MEMORY_GB = 4;
export const LOW_CORES = 4;

export function initialQuality(hints: HardwareHints): Quality {
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= LOW_MEMORY_GB) return 'low';
  if (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= LOW_CORES) return 'low';
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

/**
 * How to make the renderer at a quality. Antialiasing can only be chosen when the renderer is made, so it follows the
 * starting quality; the pixel ratio can change later.
 */
export function rendererOptions(quality: Quality, devicePixelRatio: number | undefined): { antialias: boolean; pixelRatio: number } {
  const dpr = devicePixelRatio && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return { antialias: quality === 'high', pixelRatio: Math.min(dpr, qualitySettings(quality).pixelRatioCap) };
}

/** The biggest photo size, in pixels, that only some graphics cards can hold. */
const BIG_PHOTO_PX = 4096;

/**
 * Which landing photo to load: `'high'` (4096) or `'low'` (2048). A window view never needs the big one: the photo
 * only fills part of the view. A 360 degree photo gets it at high quality on a card that can hold it.
 */
export function photoSize(kind: SurfaceKind, quality: Quality, maxTextureSize: number): Quality {
  if (kind === 'window') return 'low';
  return quality === 'high' && maxTextureSize >= BIG_PHOTO_PX ? 'high' : 'low';
}
