/**
 * Segmented control: docs/VISUAL_DESIGN.md section 6. A radio group on a glass track with a gold thumb
 * that slides (by transform) to the chosen option. One Tab stop; arrows, Home and End move and choose.
 */
import { nextRadioIndex } from './radioKeys';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedOptions {
  /** The group's name for screen readers, for example "Text size". */
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
}

export interface Segmented {
  element: HTMLElement;
  get value(): string;
  set(value: string): void;
}

export function createSegmented({ label, options, value, onChange }: SegmentedOptions): Segmented {
  const root = document.createElement('div');
  root.className = 'rp-segmented';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', label);
  root.style.setProperty('--rp-count', String(options.length));

  const thumb = document.createElement('span');
  thumb.className = 'rp-segmented__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  root.append(thumb);

  const radios = options.map((option) => {
    const radio = document.createElement('button');
    radio.type = 'button';
    radio.className = 'rp-segmented__option rp-pressable';
    radio.setAttribute('role', 'radio');
    radio.dataset.value = option.value;
    radio.textContent = option.label;
    radio.addEventListener('click', () => choose(option.value, true));
    root.append(radio);
    return radio;
  });

  let current = value;

  function choose(next: string, notify: boolean): void {
    const index = Math.max(0, options.findIndex((o) => o.value === next));
    current = options[index].value;
    root.style.setProperty('--rp-index', String(index));
    radios.forEach((radio, i) => {
      radio.setAttribute('aria-checked', String(i === index));
      radio.tabIndex = i === index ? 0 : -1; // roving tab stop: Tab reaches the group once
    });
    if (notify) onChange?.(current);
  }

  root.addEventListener('keydown', (e) => {
    const at = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = nextRadioIndex(at, e.key, radios.length);
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    radios[next].focus();
    choose(options[next].value, true);
  });

  choose(value, false);
  return {
    element: root,
    get value() {
      return current;
    },
    set: (v: string) => choose(v, false),
  };
}
