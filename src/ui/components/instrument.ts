/**
 * Instrument: docs/VISUAL_DESIGN.md section 6. An uppercase label, a big tabular number (so it does not
 * jitter), a unit and an optional bar. Highlighted shows cyan. Scanlines at 4% on high quality only.
 */
import { createProgressBar, type ProgressBar } from './progressBar';

export interface InstrumentOptions {
  /** One word, shown in capitals ("Distance"). */
  label: string;
  value: string;
  unit?: string;
  /** Show a bar under the number, from 0 to 1. */
  bar?: number;
  highlighted?: boolean;
}

export interface Instrument {
  element: HTMLElement;
  set(value: string, bar?: number): void;
  setHighlighted(on: boolean): void;
}

export function createInstrument({ label, value, unit, bar, highlighted = false }: InstrumentOptions): Instrument {
  const box = document.createElement('div');
  box.className = 'rp-glass rp-glass--hud rp-instrument';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', label);

  const name = document.createElement('span');
  name.className = 'rp-instrument__label';
  name.textContent = label;

  const reading = document.createElement('span');
  reading.className = 'rp-instrument__reading';
  const number = document.createElement('span');
  number.className = 'rp-instrument__value';
  reading.append(number);
  if (unit) {
    const u = document.createElement('span');
    u.className = 'rp-instrument__unit';
    u.textContent = unit;
    reading.append(' ', u);
  }
  box.append(name, reading);

  let meter: ProgressBar | undefined;
  if (bar !== undefined) {
    meter = createProgressBar({ label, value: bar * 100, max: 100 });
    meter.element.classList.add('rp-progress--thin');
    box.append(meter.element);
  }

  function set(next: string, nextBar?: number): void {
    number.textContent = next;
    if (meter && nextBar !== undefined) meter.set(nextBar * 100);
  }
  function setHighlighted(on: boolean): void {
    if (on) box.dataset.highlighted = '';
    else delete box.dataset.highlighted;
  }

  set(value, bar);
  setHighlighted(highlighted);
  return { element: box, set, setHighlighted };
}
