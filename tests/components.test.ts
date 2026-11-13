/** Pure parts of the docs/VISUAL_DESIGN.md section 6 components (Vitest runs without a page here). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextRadioIndex } from '../src/ui/components/radioKeys';
import { createToastQueue, TOAST_MS } from '../src/ui/components/toast';
import { starLabel } from '../src/ui/components/starRow';
import { progressFraction } from '../src/ui/components/progressBar';

describe('nextRadioIndex', () => {
  it('moves with the arrows and wraps round both ends', () => {
    expect(nextRadioIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextRadioIndex(1, 'ArrowDown', 3)).toBe(2);
    expect(nextRadioIndex(2, 'ArrowRight', 3)).toBe(0);
    expect(nextRadioIndex(0, 'ArrowLeft', 3)).toBe(2);
    expect(nextRadioIndex(2, 'ArrowUp', 3)).toBe(1);
  });

  it('Home and End go to the first and the last', () => {
    expect(nextRadioIndex(1, 'Home', 3)).toBe(0);
    expect(nextRadioIndex(1, 'End', 3)).toBe(2);
  });

  it('lets any other key through, and copes with an empty group', () => {
    expect(nextRadioIndex(1, 'Space', 3)).toBeUndefined();
    expect(nextRadioIndex(1, 'Enter', 3)).toBeUndefined();
    expect(nextRadioIndex(0, 'ArrowRight', 0)).toBeUndefined();
  });
});

describe('toast queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows each toast for 2.5 seconds, one at a time, in order', () => {
    const log: string[] = [];
    const queue = createToastQueue(
      (m) => log.push(`show ${m}`),
      () => log.push('hide'),
    );
    expect(TOAST_MS).toBe(2500);

    queue.push('+3 XP');
    queue.push('Equipped!');
    expect(log).toEqual(['show +3 XP']);
    expect(queue.waiting).toBe(1);

    vi.advanceTimersByTime(2499);
    expect(log).toEqual(['show +3 XP']);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(['show +3 XP', 'hide', 'show Equipped!']);
    expect(queue.waiting).toBe(0);

    vi.advanceTimersByTime(2500);
    expect(log).toEqual(['show +3 XP', 'hide', 'show Equipped!', 'hide']);

    queue.push('Again');
    expect(log.at(-1)).toBe('show Again');
  });
});

describe('starLabel', () => {
  it('says how many of 3 stars, in words a screen reader reads', () => {
    expect(starLabel(0)).toBe('0 of 3 stars');
    expect(starLabel(1)).toBe('1 of 3 stars');
    expect(starLabel(2)).toBe('2 of 3 stars');
    expect(starLabel(3)).toBe('3 of 3 stars');
  });

  it('clamps like the stars on today\'s screens', () => {
    expect(starLabel(-1)).toBe('0 of 3 stars');
    expect(starLabel(7)).toBe('3 of 3 stars');
    expect(starLabel(2.9)).toBe('2 of 3 stars');
  });
});

describe('progressFraction', () => {
  it('is value over max, from 0 to 1', () => {
    expect(progressFraction(0, 100)).toBe(0);
    expect(progressFraction(40, 100)).toBe(0.4);
    expect(progressFraction(100, 100)).toBe(1);
  });

  it('never goes past either end', () => {
    expect(progressFraction(150, 100)).toBe(1);
    expect(progressFraction(-5, 100)).toBe(0);
  });

  it('is empty when there is nothing to fill', () => {
    expect(progressFraction(3, 0)).toBe(0);
    expect(progressFraction(3, -1)).toBe(0);
    expect(progressFraction(Number.NaN, 10)).toBe(0);
  });
});
