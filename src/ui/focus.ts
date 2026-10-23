/**
 * Puts keyboard focus on the game area, which is not a button. Panels do this when they close instead of
 * handing focus back to their button: Space is the boost key, and Space on a focused button would press it
 * again instead of boosting. It also makes the next Tab start from the top of the page.
 */
export function focusGameArea(area: HTMLElement): void {
  area.tabIndex = -1;
  area.focus({ preventScroll: true });
}
