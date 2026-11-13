/**
 * Progress bar: docs/VISUAL_DESIGN.md section 6. A track and a fill (moved by transform, never width),
 * with optional ticks. Used for the XP bar, distance to go and chapter progress.
 */

/** How full the bar is, from 0 to 1. A max of 0 or less is an empty bar. */
export function progressFraction(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
}

export interface ProgressBarOptions {
  /** What the bar measures, for screen readers ("XP to the next rank"). */
  label: string;
  value: number;
  max: number;
  /** Number of evenly spaced tick marks inside the track (0 for none). */
  ticks?: number;
  /** How a screen reader hears the value, for example "40 of 100 XP". */
  valueText?: (value: number, max: number) => string;
}

export interface ProgressBar {
  element: HTMLElement;
  set(value: number, max?: number): void;
}

export function createProgressBar({ label, value, max, ticks = 0, valueText }: ProgressBarOptions): ProgressBar {
  const bar = document.createElement('div');
  bar.className = 'rp-progress';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', label);
  bar.setAttribute('aria-valuemin', '0');

  const fill = document.createElement('span');
  fill.className = 'rp-progress__fill';
  bar.append(fill);

  for (let i = 1; i < ticks; i++) {
    const tick = document.createElement('span');
    tick.className = 'rp-progress__tick';
    tick.style.left = `${(i / ticks) * 100}%`;
    tick.setAttribute('aria-hidden', 'true');
    bar.append(tick);
  }

  let currentMax = max;
  function set(next: number, nextMax = currentMax): void {
    currentMax = nextMax;
    const fraction = progressFraction(next, nextMax);
    const shown = Math.round(fraction * Math.max(0, nextMax));
    bar.setAttribute('aria-valuemax', String(Math.max(0, nextMax)));
    bar.setAttribute('aria-valuenow', String(shown));
    if (valueText) bar.setAttribute('aria-valuetext', valueText(shown, nextMax));
    fill.style.transform = `scaleX(${fraction})`;
  }

  set(value, max);
  return { element: bar, set };
}
