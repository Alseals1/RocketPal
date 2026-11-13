/**
 * Toast: docs/VISUAL_DESIGN.md section 6. A small glass chip at the top centre for 2.5 seconds, read
 * politely by screen readers. Several toasts wait their turn, in order.
 */

export const TOAST_MS = 2500;

export interface ToastQueue {
  push(message: string): void;
  /** How many are waiting (not counting the one showing). */
  readonly waiting: number;
}

/** The timing alone, with no page: `show` one message at a time, `hide` it after `ms`, then the next. */
export function createToastQueue(show: (message: string) => void, hide: () => void, ms = TOAST_MS): ToastQueue {
  const queue: string[] = [];
  let showing = false;

  function next(): void {
    const message = queue.shift();
    if (message === undefined) {
      showing = false;
      return;
    }
    showing = true;
    show(message);
    setTimeout(() => {
      hide();
      next();
    }, ms);
  }

  return {
    push(message: string) {
      queue.push(message);
      if (!showing) next();
    },
    get waiting() {
      return queue.length;
    },
  };
}

/** One live region in `parent`, and a queue that shows toasts in it. */
export function createToaster(parent: HTMLElement, ms = TOAST_MS): ToastQueue & { element: HTMLElement } {
  const region = document.createElement('div');
  region.className = 'rp-toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  const chip = document.createElement('p');
  chip.className = 'rp-glass rp-glass--hud rp-toast';
  region.append(chip);
  parent.append(region);

  const queue = createToastQueue(
    (message) => {
      chip.textContent = message;
      chip.setAttribute('data-visible', '');
    },
    () => {
      chip.removeAttribute('data-visible');
      chip.textContent = '';
    },
    ms,
  );
  return {
    element: region,
    push: (message: string) => queue.push(message),
    get waiting() {
      return queue.waiting;
    },
  };
}
