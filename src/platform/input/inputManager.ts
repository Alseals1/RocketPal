/**
 * Turns the keyboard and touch into one `FlightInput`, and keys and buttons into actions
 * (docs/TECHNICAL_ARCHITECTURE.md 4.15). Replaces `InputController` (src/flight/input.ts) with the same behaviour.
 * See decisions/2026-11-12-platform-services.md.
 */
import type { FlightInput } from '../../flight/flightModel';
import type { Action } from './actions';
import { createKeyboardSource } from './keyboardSource';
import type { ManagedSource, SourceKind } from './sources';
import { createTouchStickSource, type TouchControls } from './touchStickSource';

export type { Action } from './actions';
export type { InputSource, SourceKind } from './sources';
export { buildTouchControls } from './touchStickSource';

export interface InputManager {
  /** All active sources merged (as `InputController.read()` did). */
  flight(): FlightInput;
  onAction(a: Action, fn: () => void): () => void;
  isSteering(): boolean;
  /** Turns sources on or off. Any call lets go of everything held. `pointerDrag` and `gamepad` come later (#56, Phase 2). */
  setSources(kinds: SourceKind[]): void;
}

export interface InputManagerOptions {
  /** The stick and BOOST button, from `buildTouchControls`. */
  controls: TouchControls;
  /** Show the touch controls from the start. */
  showTouchControls: boolean;
  /** True while something covers the game (the settings panel, a fact card): everything reads zero then. */
  isBlocked?: () => boolean;
  /** Where keys, focus and touches come from. */
  target?: EventTarget;
  /** The page, for "the tab was hidden". */
  page?: EventTarget & { readonly hidden: boolean };
}

const STILL: FlightInput = { turn: 0, pitch: 0, boost: false };

export function createInputManager({
  controls,
  showTouchControls,
  isBlocked = () => false,
  target = window,
  page = document,
}: InputManagerOptions): InputManager & { dispose(): void } {
  const listeners = new Map<Action, Set<() => void>>();
  const dispatch = (action: Action) => {
    for (const fn of [...(listeners.get(action) ?? [])]) fn();
  };

  // In merge order: on each axis the first source that is steering wins (the keyboard over the stick).
  const sources: ManagedSource[] = [
    createKeyboardSource({ target, isBlocked, onAction: (a) => !isBlocked() && dispatch(a) }),
    createTouchStickSource({ controls, wanted: showTouchControls, showOn: target, onAction: (a) => !isBlocked() && dispatch(a) }),
  ];
  const releaseAll = () => sources.forEach((s) => s.release());

  // If the window loses focus or the tab is hidden we may never hear a key or finger come up, so let go of everything.
  const onBlur = () => releaseAll();
  const onVisibility = () => {
    if (page.hidden) releaseAll();
  };
  target.addEventListener('blur', onBlur);
  page.addEventListener('visibilitychange', onVisibility);

  return {
    flight() {
      if (isBlocked()) return { ...STILL };
      const result = { ...STILL };
      let turnSet = false;
      let pitchSet = false;
      for (const source of sources) {
        const part = source.read();
        if (!turnSet && part.turn) {
          result.turn = part.turn;
          turnSet = true;
        }
        if (!pitchSet && part.pitch) {
          result.pitch = part.pitch;
          pitchSet = true;
        }
        if (part.boost) result.boost = true;
      }
      return result;
    },
    isSteering: () => !isBlocked() && sources.some((s) => s.isSteering()),
    onAction(action, fn) {
      let set = listeners.get(action);
      if (!set) listeners.set(action, (set = new Set()));
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    setSources(kinds) {
      releaseAll();
      for (const source of sources) source.setEnabled(kinds.includes(source.kind));
    },
    dispose() {
      target.removeEventListener('blur', onBlur);
      page.removeEventListener('visibilitychange', onVisibility);
      for (const source of sources) source.dispose();
      listeners.clear();
    },
  };
}
