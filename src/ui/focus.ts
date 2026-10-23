/**
 * Puts keyboard focus on the game area, which is not a button. Panels do this when they close instead of
 * handing focus back to their button: Space is the boost key, and Space on a focused button would press it
 * again instead of boosting. It also makes the next Tab start from the top of the page.
 */
export function focusGameArea(area: HTMLElement): void {
  area.tabIndex = -1;
  area.focus({ preventScroll: true });
}

/**
 * While a dialog is open, Tab and Shift+Tab go round its own buttons and never reach the game behind it.
 * Call this from a keydown handler when the key is Tab.
 */
export function keepTabInside(container: HTMLElement, e: KeyboardEvent): void {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter((b) => b.tabIndex >= 0);
  if (buttons.length === 0) return;
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  const inside = container.contains(document.activeElement);
  if (!inside || (e.shiftKey && document.activeElement === first)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
