/**
 * Dialog: docs/VISUAL_DESIGN.md section 6. Strong glass over a scrim, title in the world colour, body,
 * source line and an actions row. It grows from the element that opened it, keeps Tab inside, closes on
 * Escape, and hands focus back to the opener.
 */
import { keepTabInside } from '../focus';
import { createButton, type ButtonKind } from './button';

export interface DialogAction {
  label: string;
  kind?: Exclude<ButtonKind, 'icon'>;
  /** Called on press. The dialog closes afterwards unless this returns false. */
  onPress?: () => boolean | void;
}

export interface DialogOptions {
  title: string;
  /** Plain text paragraphs, or an element the caller built. */
  body: string | HTMLElement;
  source?: string;
  actions: DialogAction[];
  /** A world colour token name, for example 'mars' for `--world-mars`. Gold when absent. */
  world?: string;
  /** The element that opened the dialog: focus goes back to it, and the dialog grows from it. */
  opener?: HTMLElement | null;
  /** Where the dialog goes. The page body by default. */
  parent?: HTMLElement;
  onClose?: () => void;
}

export interface DialogHandle {
  element: HTMLElement;
  close(): void;
}

let nextId = 0;

export function openDialog(options: DialogOptions): DialogHandle {
  const { title, body, source, actions, world, opener, parent = document.body, onClose } = options;
  const id = `rp-dialog-title-${++nextId}`;

  const scrim = document.createElement('div');
  scrim.className = 'rp-scrim';

  const dialog = document.createElement('div');
  dialog.className = 'rp-glass rp-glass--dialog rp-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', id);
  if (world) dialog.style.setProperty('--rp-world', `var(--world-${world})`);

  const heading = document.createElement('h2');
  heading.className = 'rp-dialog__title';
  heading.id = id;
  heading.tabIndex = -1;
  heading.textContent = title;
  dialog.append(heading);

  const content = document.createElement('div');
  content.className = 'rp-dialog__body';
  if (typeof body === 'string') {
    for (const text of body.split('\n\n')) {
      const p = document.createElement('p');
      p.textContent = text;
      content.append(p);
    }
  } else {
    content.append(body);
  }
  dialog.append(content);

  if (source) {
    const line = document.createElement('p');
    line.className = 'rp-dialog__source';
    line.textContent = source;
    dialog.append(line);
  }

  const row = document.createElement('div');
  row.className = 'rp-dialog__actions';
  for (const action of actions) {
    const button = createButton({ kind: action.kind ?? 'secondary', label: action.label });
    button.addEventListener('click', () => {
      if (action.onPress?.() !== false) close();
    });
    row.append(button);
  }
  dialog.append(row);
  scrim.append(dialog);

  let closed = false;
  function close(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    onClose?.();
    opener?.focus({ preventScroll: true });
  }

  // On the document, not the scrim: a click on the body text moves focus to <body>, and Escape and Tab must
  // still work from there. Only the topmost open dialog answers, so one Escape closes one dialog.
  function onKey(e: KeyboardEvent): void {
    const scrims = document.querySelectorAll('.rp-scrim');
    if (scrims[scrims.length - 1] !== scrim) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      keepTabInside(dialog, e);
    }
  }
  document.addEventListener('keydown', onKey);

  parent.append(scrim);

  // Grow from the opener: the transform origin is the opener's centre, in the dialog's own box.
  if (opener) {
    const from = opener.getBoundingClientRect();
    const box = dialog.getBoundingClientRect();
    dialog.style.transformOrigin = `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`;
  }
  heading.focus({ preventScroll: true });
  // The next frame starts the transition from the closed state (scale 0.96, transparent).
  requestAnimationFrame(() => scrim.setAttribute('data-open', ''));

  return { element: dialog, close };
}
