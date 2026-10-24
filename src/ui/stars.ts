/** Shows 0 to 3 stars. Filled and empty stars differ in shape, not only colour, and a screen reader hears the number in words. */
export const MAX_STARS = 3;

export function setStars(el: HTMLElement, stars: number): void {
  const n = Math.max(0, Math.min(MAX_STARS, Math.floor(stars)));
  el.textContent = '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${n} of ${MAX_STARS} stars`);
  el.dataset.stars = String(n);
}
