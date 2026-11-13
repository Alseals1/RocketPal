/**
 * Hotspot: docs/VISUAL_DESIGN.md section 6. A 56 px button on a photo or fly-by view: a cyan ring with
 * a soft inner pulse (new), a thick ring when focused, and a mint fill, tick and label chip once found.
 * No pulse with reduced motion.
 */
import { ICONS } from './button';

export type HotspotState = 'new' | 'found';

export interface HotspotOptions {
  /** What the spot is ("The edge of Jezero Crater"). */
  label: string;
  state?: HotspotState;
  onPress?: () => void;
}

export interface Hotspot {
  element: HTMLButtonElement;
  setState(state: HotspotState): void;
}

export function createHotspot({ label, state = 'new', onPress }: HotspotOptions): Hotspot {
  const spot = document.createElement('button');
  spot.type = 'button';
  spot.className = 'rp-hotspot rp-pressable';

  const pulse = document.createElement('span');
  pulse.className = 'rp-hotspot__pulse';
  const ring = document.createElement('span');
  ring.className = 'rp-hotspot__ring';
  const tick = document.createElement('span');
  tick.className = 'rp-hotspot__tick';
  tick.innerHTML = ICONS.tick;
  const chip = document.createElement('span');
  chip.className = 'rp-hotspot__chip';
  chip.textContent = label;
  for (const part of [pulse, ring, tick, chip]) part.setAttribute('aria-hidden', 'true');
  spot.append(pulse, ring, tick, chip);

  spot.addEventListener('click', () => onPress?.());

  function setState(next: HotspotState): void {
    spot.dataset.state = next;
    spot.setAttribute('aria-label', next === 'found' ? `${label}, found` : label);
  }

  setState(state);
  return { element: spot, setState };
}
