/**
 * Tile: docs/VISUAL_DESIGN.md section 6. A raised rectangle with a picture, a title, a small line and
 * an optional badge. Used for Star Map worlds, answers, garage items, missions and Journal pages.
 *
 * States: rest, selected (holographic cyan edge and glow), locked (padlock and the condition, still
 * focusable so it can be read), done (mint tick), new (gold dot). Every badge has words for screen readers.
 */
import { hiddenLabel, ICONS } from './button';

export type TileState = 'rest' | 'selected' | 'locked' | 'done' | 'new';

export interface TileOptions {
  title: string;
  line?: string;
  /** A picture URL from the game's own files. Decorative: the title names the tile. */
  picture?: string;
  state?: TileState;
  /** What unlocks a locked tile, in words ("Find 3 things on Mars"). Shown and read. */
  condition?: string;
  onPress?: () => void;
}

export interface Tile {
  element: HTMLButtonElement;
  setState(state: TileState, condition?: string): void;
}

export function createTile({ title, line, picture, state = 'rest', condition, onPress }: TileOptions): Tile {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'rp-tile rp-pressable';

  if (picture) {
    const img = document.createElement('img');
    img.className = 'rp-tile__picture';
    img.src = picture;
    img.alt = '';
    img.loading = 'lazy';
    tile.append(img);
  }

  const text = document.createElement('span');
  text.className = 'rp-tile__text';
  const name = document.createElement('span');
  name.className = 'rp-tile__title';
  name.textContent = title;
  text.append(name);
  if (line) {
    const small = document.createElement('span');
    small.className = 'rp-tile__line';
    small.textContent = line;
    text.append(small);
  }
  const conditionLine = document.createElement('span');
  conditionLine.className = 'rp-tile__condition';
  text.append(conditionLine);
  tile.append(text);

  const badge = document.createElement('span');
  badge.className = 'rp-tile__badge';
  tile.append(badge);

  let current: TileState = state;
  tile.addEventListener('click', () => {
    if (current !== 'locked') onPress?.();
  });

  function setState(next: TileState, nextCondition = condition): void {
    current = next;
    tile.dataset.state = next;
    tile.setAttribute('aria-pressed', String(next === 'selected'));
    if (next === 'locked') tile.setAttribute('aria-disabled', 'true');
    else tile.removeAttribute('aria-disabled');

    conditionLine.textContent = next === 'locked' && nextCondition ? nextCondition : '';
    badge.replaceChildren();
    if (next === 'locked') {
      badge.innerHTML = ICONS.padlock;
      badge.append(hiddenLabel('Locked'));
    } else if (next === 'done') {
      badge.innerHTML = ICONS.tick;
      badge.append(hiddenLabel('Done'));
    } else if (next === 'new') {
      const dot = document.createElement('span');
      dot.className = 'rp-tile__new-dot';
      badge.append(dot, hiddenLabel('New'));
    }
    badge.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  }

  setState(state);
  return { element: tile, setState };
}
