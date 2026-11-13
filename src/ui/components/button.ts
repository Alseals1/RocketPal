/** Buttons: docs/VISUAL_DESIGN.md section 6. Primary is the one main action on a screen. */

export type ButtonKind = 'primary' | 'secondary' | 'icon';

export interface ButtonOptions {
  kind: ButtonKind;
  /** The words on the button. An icon button keeps them hidden but a screen reader reads them. */
  label: string;
  /** An inline SVG from the game's own code (never from data). Required for `icon`. */
  icon?: string;
}

/** A visually hidden span: read by screen readers, not shown. */
export function hiddenLabel(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'rp-visually-hidden';
  span.textContent = text;
  return span;
}

export function createButton({ kind, label, icon }: ButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `rp-button rp-button--${kind} rp-pressable`;
  if (icon) {
    const holder = document.createElement('span');
    holder.className = 'rp-button__icon';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML = icon;
    button.append(holder);
  }
  if (kind === 'icon') {
    button.append(hiddenLabel(label));
  } else {
    const text = document.createElement('span');
    text.className = 'rp-button__label';
    text.textContent = label;
    button.append(text);
  }
  return button;
}

/** A few icons for the gallery and the first screens. 24 x 24, drawn in the current text colour. */
export const ICONS = {
  listen:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-8.8v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M11 10h2v7h-2zM11 7h2v2h-2z"/></svg>',
  tick:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5 10 17l9-10"/></svg>',
  padlock:
    '<svg viewBox="0 0 24 24" width="24" height="24" focusable="false"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>',
} as const;
