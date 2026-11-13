/**
 * Steering with the keyboard: WASD or the arrows (up = nose up), Space = boost. Also turns keys into actions
 * (see `actions.ts`). Moved from `InputController` (src/flight/input.ts) with the same rules.
 */
import { actionsForKey, type Action } from './actions';
import type { ManagedSource } from './sources';

type Direction = 'left' | 'right' | 'up' | 'down' | 'boost';

const KEYS: Record<string, Direction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'boost',
};

export interface KeyboardSourceOptions {
  /** Where key events come from: `window` in the game, a plain EventTarget in tests. */
  target: EventTarget;
  /** True while something covers the game (the settings panel): flight keys and actions are then ignored. */
  isBlocked: () => boolean;
  onAction: (action: Action) => void;
}

/** True when the key was pressed on a button (or inside one), so Space should press that button instead. */
function isOnButton(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === 'function' && Boolean(el.closest('button'));
}

export function createKeyboardSource({ target, isBlocked, onAction }: KeyboardSourceOptions): ManagedSource {
  const held = new Set<Direction>();
  let enabled = true;

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (!enabled || isBlocked()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts like Cmd+D and Cmd+S alone
    if (e.code === 'Space' && isOnButton(e.target)) return; // let Space press a focused button
    if (e.code in KEYS) {
      e.preventDefault();
      held.add(KEYS[e.code]);
    }
    // Actions fire once per press. They never prevent the browser's default, so the panels' own Escape, Enter
    // and Tab handling is untouched.
    if (!e.repeat) for (const action of actionsForKey(e.code)) onAction(action);
  };
  const onKeyUp = (event: Event) => {
    const code = (event as KeyboardEvent).code;
    if (code in KEYS) held.delete(KEYS[code]);
  };
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);

  return {
    kind: 'keyboard',
    get active() {
      return enabled;
    },
    read() {
      if (!enabled) return {};
      return {
        turn: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
        pitch: (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0),
        boost: held.has('boost'),
      };
    },
    // Both arrows held counts as steering, even though they cancel out (as before).
    isSteering: () => enabled && (held.has('left') || held.has('right') || held.has('up') || held.has('down')),
    release: () => held.clear(),
    setEnabled(on) {
      enabled = on;
      if (!on) held.clear();
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      held.clear();
    },
  };
}
