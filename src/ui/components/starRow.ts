/**
 * Star row: docs/VISUAL_DESIGN.md section 6. Three stars, filled or outline (they differ in shape, not
 * only colour), and "2 of 3 stars" for screen readers. A newly earned star pops in with a small spring.
 */
import { clampStars, MAX_STARS } from '../stars';

/** What a screen reader hears, for example "2 of 3 stars". */
export function starLabel(stars: number): string {
  return `${clampStars(stars)} of ${MAX_STARS} stars`;
}

const FILLED =
  '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const OUTLINE =
  '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 4.8l2.2 4.6 5 .6-3.7 3.5 1 5L12 16l-4.5 2.5 1-5L4.8 10l5-.6z"/></svg>';

export interface StarRow {
  element: HTMLElement;
  set(stars: number): void;
}

export function createStarRow(stars: number): StarRow {
  const row = document.createElement('span');
  row.className = 'rp-stars';
  row.setAttribute('role', 'img');

  let shown = -1;
  function set(next: number): void {
    const n = clampStars(next);
    row.setAttribute('aria-label', starLabel(n));
    row.dataset.stars = String(n);
    const before = shown;
    row.replaceChildren(
      ...Array.from({ length: MAX_STARS }, (_, i) => {
        const star = document.createElement('span');
        const filled = i < n;
        star.className = `rp-star ${filled ? 'rp-star--filled' : 'rp-star--outline'}`;
        if (filled && before >= 0 && i >= before) star.dataset.new = ''; // earned just now: the spring
        star.innerHTML = filled ? FILLED : OUTLINE;
        return star;
      }),
    );
    shown = n;
  }

  set(stars);
  return { element: row, set };
}
