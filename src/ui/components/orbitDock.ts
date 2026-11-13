/**
 * Orbit dock: docs/VISUAL_DESIGN.md section 6. Orbit's 72 px portrait, a glass speech bubble that
 * screen readers hear politely, and a Listen button. States: idle (the bubble is empty and faded out, but
 * stays in the accessibility tree so the next line is announced), talking (the bubble grows in), happy.
 * Read-aloud itself comes later (#34): Listen calls the callback it is given.
 */
import { createButton, ICONS } from './button';

export type OrbitMood = 'neutral' | 'happy' | 'thinking';
export type OrbitState = 'idle' | 'talking' | 'happy';

export interface OrbitDockOptions {
  onListen: (text: string) => void;
  text?: string;
  state?: OrbitState;
}

export interface OrbitDock {
  element: HTMLElement;
  /** Orbit says something (talking), or something happy. */
  say(text: string, state?: Exclude<OrbitState, 'idle'>): void;
  /** Orbit stops talking: the bubble goes. */
  idle(): void;
}

const MOOD: Record<OrbitState, OrbitMood> = { idle: 'neutral', talking: 'neutral', happy: 'happy' };

export function createOrbitDock({ onListen, text = '', state = text ? 'talking' : 'idle' }: OrbitDockOptions): OrbitDock {
  const dock = document.createElement('div');
  dock.className = 'rp-orbit';

  const portrait = document.createElement('img');
  portrait.className = 'rp-orbit__portrait';
  portrait.alt = 'Orbit';
  portrait.width = 72;
  portrait.height = 72;

  const talk = document.createElement('div');
  talk.className = 'rp-orbit__talk';
  const bubble = document.createElement('p');
  bubble.className = 'rp-glass rp-glass--hud rp-orbit__bubble';
  bubble.setAttribute('aria-live', 'polite');
  const listen = createButton({ kind: 'icon', label: 'Listen to Orbit', icon: ICONS.listen });
  listen.classList.add('rp-orbit__listen');
  listen.addEventListener('click', () => onListen(bubble.textContent ?? ''));
  talk.append(bubble, listen);

  dock.append(portrait, talk);

  function show(next: OrbitState, words: string): void {
    dock.dataset.state = next;
    portrait.src = `/images/orbit-${MOOD[next]}.png`;
    bubble.textContent = next === 'idle' ? '' : words;
    listen.hidden = next === 'idle';
  }

  show(state, text);
  return {
    element: dock,
    say: (words, next = 'talking') => show(next, words),
    idle: () => show('idle', ''),
  };
}
