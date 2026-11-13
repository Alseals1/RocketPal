/** Pure parts of the docs/VISUAL_DESIGN.md section 6 components (Vitest runs without a page here). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextRadioIndex } from '../src/ui/components/radioKeys';
import { createToastQueue, TOAST_MS } from '../src/ui/components/toast';

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
