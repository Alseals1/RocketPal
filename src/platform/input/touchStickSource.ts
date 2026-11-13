/**
 * Steering by touch: a stick on the left (drag up = nose up) and a BOOST button on the right. Moved from
 * `InputController` (src/flight/input.ts) with the same rules. The pointer logic works on plain `EventTarget`s so it
 * can be unit-tested; `buildTouchControls` makes the real HTML.
 */
import type { Action } from './actions';
import type { ManagedSource } from './sources';

/** The stick does nothing until it is pushed this far from the middle (0..1). */
export const DEAD_ZONE = 0.15;

export interface Box {
  left: number;
  top: number;
  width: number;
}

/** Where a finger at (clientX, clientY) puts the stick: -1..1 on each axis, never outside the circle. */
export function stickVector(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const radius = box.width / 2;
  let x = (clientX - (box.left + radius)) / radius;
  let y = (clientY - (box.top + radius)) / radius;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/** A control a finger can press: a real element in the game, a fake in tests. */
export interface PointerTarget extends EventTarget {
  getBoundingClientRect(): Box;
  setPointerCapture?(pointerId: number): void;
}

/** The elements the touch source works with. */
export interface TouchControls {
  /** `hidden` is a boolean or 'until-found' on a real element. */
  root: { hidden: boolean | string };
  stick: PointerTarget;
  thumb: { style: { transform: string } };
  boost: PointerTarget & { classList: { add(name: string): void; remove(name: string): void } };
}

/** Makes the stick and BOOST button (the same HTML as before) and adds them to `parent`. */
export function buildTouchControls(parent: HTMLElement): TouchControls {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.hidden = true;
  root.innerHTML = `
      <div class="stick" data-testid="stick" aria-label="Steering stick"><div class="stick-thumb"></div></div>
      <button class="boost-button" data-testid="boost-button" type="button">BOOST</button>`;
  parent.appendChild(root);
  return {
    root,
    stick: root.querySelector('.stick') as HTMLElement,
    thumb: root.querySelector('.stick-thumb') as HTMLElement,
    boost: root.querySelector('.boost-button') as HTMLElement,
  };
}

export interface TouchStickOptions {
  controls: TouchControls;
  /** Show the controls from the start (a touch screen, or `?touch=1`). */
  wanted: boolean;
  /** The first `touchstart` here shows the controls on a device we did not expect to have touch. */
  showOn: EventTarget;
  onAction: (action: Action) => void;
}

export function createTouchStickSource({ controls, wanted: wantedAtStart, showOn, onAction }: TouchStickOptions): ManagedSource {
  const { root, stick, thumb, boost } = controls;
  let wanted = wantedAtStart;
  let enabled = true;
  let vector = { x: 0, y: 0 };
  let stickId: number | null = null;
  let boostId: number | null = null;
  const cleanups: Array<() => void> = [];

  const listen = (el: EventTarget, type: string, fn: (e: Event) => void, options?: AddEventListenerOptions) => {
    el.addEventListener(type, fn, options);
    cleanups.push(() => el.removeEventListener(type, fn, options));
  };
  const showOrHide = () => {
    root.hidden = !(enabled && wanted);
  };

  // The stick.
  const move = (e: PointerEvent) => {
    const box = stick.getBoundingClientRect();
    vector = stickVector(e.clientX, e.clientY, box);
    const reach = (box.width / 2) * 0.6;
    thumb.style.transform = `translate(${vector.x * reach}px, ${vector.y * reach}px)`;
  };
  const letGoOfStick = () => {
    stickId = null;
    vector = { x: 0, y: 0 };
    thumb.style.transform = 'translate(0, 0)';
  };
  const releaseStick = (e: Event) => {
    if ((e as PointerEvent).pointerId === stickId) letGoOfStick();
  };
  listen(stick, 'contextmenu', (e) => e.preventDefault());
  listen(stick, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (!enabled || stickId !== null) return;
    stickId = e.pointerId;
    capture(stick, e.pointerId);
    move(e);
  });
  listen(stick, 'pointermove', (event) => {
    const e = event as PointerEvent;
    if (e.pointerId === stickId) move(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(stick, type, releaseStick);

  // The BOOST button. Only the finger that pressed it can let it go: a second finger lifting must not stop the boost.
  const letGoOfBoost = () => {
    boostId = null;
    boost.classList.remove('is-down');
  };
  const releaseBoost = (e: Event) => {
    if ((e as PointerEvent).pointerId === boostId) letGoOfBoost();
  };
  listen(boost, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (!enabled || boostId !== null) return;
    boostId = e.pointerId;
    capture(boost, e.pointerId);
    boost.classList.add('is-down');
    onAction('boost');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(boost, type, releaseBoost);
  listen(boost, 'contextmenu', (e) => e.preventDefault());

  // If a touch happens on a device we did not expect, show the controls.
  listen(
    showOn,
    'touchstart',
    () => {
      wanted = true;
      showOrHide();
    },
    { once: true, passive: true },
  );
  showOrHide();

  const release = () => {
    letGoOfStick();
    letGoOfBoost();
  };
  const stickActive = () => Math.hypot(vector.x, vector.y) > DEAD_ZONE;

  return {
    kind: 'touchStick',
    get active() {
      return enabled;
    },
    read() {
      if (!enabled) return {};
      const boosting = boostId !== null;
      return stickActive() ? { turn: vector.x, pitch: -vector.y, boost: boosting } : { boost: boosting };
    },
    isSteering: () => enabled && stickActive(),
    release,
    setEnabled(on) {
      enabled = on;
      if (!on) release();
      showOrHide();
    },
    dispose() {
      release();
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}

/** Keeps a finger attached to a control even if it slides off. Some browsers refuse; the control still works without it. */
function capture(el: PointerTarget, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    // The pointer is already gone, or capture is not available.
  }
}
