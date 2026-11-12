import { describe, expect, it, vi } from 'vitest';
import { ACTION_KEYS, actionsForKey, type Action } from '../src/platform/input/actions';
import { createInputManager } from '../src/platform/input/inputManager';
import { DEAD_ZONE, stickVector, type TouchControls } from '../src/platform/input/touchStickSource';

/** A key event with the fields the input code reads. */
function key(type: 'keydown' | 'keyup', code: string, opts: { repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: unknown } = {}) {
  const e = new Event(type, { cancelable: true });
  for (const [name, value] of Object.entries({ code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...opts })) {
    Object.defineProperty(e, name, { value });
  }
  return e;
}

/** A pointer event at a point on the screen. */
function pointer(type: string, pointerId: number, clientX = 0, clientY = 0) {
  const e = new Event(type);
  Object.defineProperties(e, { pointerId: { value: pointerId }, clientX: { value: clientX }, clientY: { value: clientY } });
  return e;
}

/** A pretend element 100 px wide at (0, 0), so its middle is (50, 50). */
function fakeElement() {
  const el = new EventTarget() as EventTarget & {
    getBoundingClientRect(): { left: number; top: number; width: number };
    setPointerCapture(id: number): void;
    classList: { names: Set<string>; add(n: string): void; remove(n: string): void };
  };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100 });
  el.setPointerCapture = () => {};
  const names = new Set<string>();
  el.classList = { names, add: (n) => names.add(n), remove: (n) => names.delete(n) };
  return el;
}

function setUp(opts: { touch?: boolean; blocked?: () => boolean } = {}) {
  const target = new EventTarget();
  const page = Object.assign(new EventTarget(), { hidden: false });
  const controls = {
    root: { hidden: true },
    stick: fakeElement(),
    thumb: { style: { transform: '' } },
    boost: fakeElement(),
  } satisfies TouchControls;
  const input = createInputManager({ controls, showTouchControls: opts.touch ?? false, isBlocked: opts.blocked, target, page });
  const press = (code: string, o?: Parameters<typeof key>[2]) => {
    const e = key('keydown', code, o);
    target.dispatchEvent(e);
    return e;
  };
  const lift = (code: string) => target.dispatchEvent(key('keyup', code));
  const stickTo = (x: number, y: number, id = 1) => {
    controls.stick.dispatchEvent(pointer('pointerdown', id, x, y));
    controls.stick.dispatchEvent(pointer('pointermove', id, x, y));
  };
  return { input, target, page, controls, press, lift, stickTo };
}

describe('keyboard flying', () => {
  it.each([
    ['ArrowLeft', { turn: -1, pitch: 0, boost: false }],
    ['KeyA', { turn: -1, pitch: 0, boost: false }],
    ['ArrowRight', { turn: 1, pitch: 0, boost: false }],
    ['KeyD', { turn: 1, pitch: 0, boost: false }],
    ['ArrowUp', { turn: 0, pitch: 1, boost: false }],
    ['KeyW', { turn: 0, pitch: 1, boost: false }],
    ['ArrowDown', { turn: 0, pitch: -1, boost: false }],
    ['KeyS', { turn: 0, pitch: -1, boost: false }],
    ['Space', { turn: 0, pitch: 0, boost: true }],
  ])('%s flies', (code, expected) => {
    const { input, press, lift } = setUp();
    press(code);
    expect(input.flight()).toEqual(expected);
    lift(code);
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
  });

  it('stops the browser scrolling for flight keys only', () => {
    const { press } = setUp();
    expect(press('ArrowUp').defaultPrevented).toBe(true);
    expect(press('Space').defaultPrevented).toBe(true);
    expect(press('KeyQ').defaultPrevented).toBe(false);
    expect(press('Tab').defaultPrevented).toBe(false);
  });

  it('leaves browser shortcuts alone', () => {
    const { input, press } = setUp();
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      const e = press('KeyD', { [mod]: true });
      expect(e.defaultPrevented).toBe(false);
    }
    expect(input.flight().turn).toBe(0);
  });

  it('lets Space press a focused button', () => {
    const { input, press } = setUp();
    const button = { closest: (s: string) => (s === 'button' ? {} : null) };
    const e = press('Space', { target: button });
    expect(e.defaultPrevented).toBe(false);
    expect(input.flight().boost).toBe(false);
  });

  it('ignores keys and reads still while something covers the game', () => {
    let blocked = true;
    const { input, press } = setUp({ blocked: () => blocked });
    press('ArrowLeft');
    blocked = false;
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
    press('ArrowLeft');
    expect(input.isSteering()).toBe(true);
    blocked = true;
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
    expect(input.isSteering()).toBe(false);
  });

  it('lets go of everything when the window loses focus or the tab is hidden', () => {
    const { input, target, page, press, stickTo, controls } = setUp({ touch: true });
    press('ArrowLeft');
    target.dispatchEvent(new Event('blur'));
    expect(input.isSteering()).toBe(false);

    press('Space');
    stickTo(100, 50);
    controls.boost.dispatchEvent(pointer('pointerdown', 2));
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
    expect(controls.thumb.style.transform).toBe('translate(0, 0)');
  });

  it('does not let go when the tab becomes visible', () => {
    const { input, page, press } = setUp();
    press('ArrowLeft');
    page.dispatchEvent(new Event('visibilitychange'));
    expect(input.flight().turn).toBe(-1);
  });

  it('counts both arrows held as steering, even though they cancel out', () => {
    const { input, press } = setUp();
    press('ArrowLeft');
    press('ArrowRight');
    expect(input.flight().turn).toBe(0);
    expect(input.isSteering()).toBe(true);
  });

  it('does not count boost alone as steering', () => {
    const { input, press } = setUp();
    press('Space');
    expect(input.isSteering()).toBe(false);
  });
});

describe('touch flying', () => {
  it('keeps the stick inside its circle', () => {
    expect(stickVector(200, 50, { left: 0, top: 0, width: 100 })).toEqual({ x: 1, y: 0 });
    const v = stickVector(100, 100, { left: 0, top: 0, width: 100 });
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(stickVector(75, 25, { left: 0, top: 0, width: 100 })).toEqual({ x: 0.5, y: -0.5 });
  });

  it('steers with the stick (drag up = nose up) and moves the thumb', () => {
    const { input, stickTo, controls } = setUp({ touch: true });
    stickTo(75, 25);
    expect(input.flight()).toEqual({ turn: 0.5, pitch: 0.5, boost: false });
    expect(input.isSteering()).toBe(true);
    expect(controls.thumb.style.transform).toBe('translate(15px, -15px)');
  });

  it('ignores the stick inside the dead zone', () => {
    const { input, stickTo } = setUp({ touch: true });
    stickTo(50 + 50 * DEAD_ZONE * 0.9, 50);
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
    expect(input.isSteering()).toBe(false);
  });

  it('lets the keyboard win on each axis', () => {
    const { input, stickTo, press } = setUp({ touch: true });
    stickTo(75, 25); // right and up
    press('ArrowLeft');
    expect(input.flight()).toEqual({ turn: -1, pitch: 0.5, boost: false });
  });

  it('lets go of the stick when that finger lifts, and not for another finger', () => {
    const { input, stickTo, controls } = setUp({ touch: true });
    stickTo(100, 50, 1);
    controls.stick.dispatchEvent(pointer('pointerdown', 2, 0, 50)); // a second finger cannot take the stick
    expect(input.flight().turn).toBe(1);
    controls.stick.dispatchEvent(pointer('pointerup', 2));
    expect(input.flight().turn).toBe(1);
    controls.stick.dispatchEvent(pointer('pointercancel', 1));
    expect(input.flight().turn).toBe(0);
  });

  it('boosts while the BOOST button is held, and only its own finger lets go', () => {
    const { input, controls } = setUp({ touch: true });
    controls.boost.dispatchEvent(pointer('pointerdown', 5));
    expect(input.flight().boost).toBe(true);
    expect(controls.boost.classList.names.has('is-down')).toBe(true);
    controls.boost.dispatchEvent(pointer('pointerdown', 6));
    controls.boost.dispatchEvent(pointer('pointerup', 6));
    expect(input.flight().boost).toBe(true);
    controls.boost.dispatchEvent(pointer('lostpointercapture', 5));
    expect(input.flight().boost).toBe(false);
    expect(controls.boost.classList.names.has('is-down')).toBe(false);
  });

  it('shows the controls only when wanted', () => {
    expect(setUp({ touch: true }).controls.root.hidden).toBe(false);
    expect(setUp({ touch: false }).controls.root.hidden).toBe(true);
  });

  it('shows the controls after the first touch', () => {
    const { controls, target } = setUp({ touch: false });
    target.dispatchEvent(new Event('touchstart'));
    expect(controls.root.hidden).toBe(false);
  });
});

describe('setSources', () => {
  it('keyboard only hides the touch controls and lets go of everything', () => {
    const { input, controls, press, stickTo } = setUp({ touch: true });
    press('ArrowUp');
    stickTo(100, 50);
    input.setSources(['keyboard']);
    expect(controls.root.hidden).toBe(true);
    expect(input.flight()).toEqual({ turn: 0, pitch: 0, boost: false });
    // The keyboard still works; the stick does not.
    press('ArrowUp');
    stickTo(100, 50, 9);
    expect(input.flight()).toEqual({ turn: 0, pitch: 1, boost: false });
  });

  it('turning touch back on shows the controls again only if they are wanted', () => {
    const wanted = setUp({ touch: true });
    wanted.input.setSources(['keyboard']);
    wanted.input.setSources(['keyboard', 'touchStick']);
    expect(wanted.controls.root.hidden).toBe(false);

    const notWanted = setUp({ touch: false });
    notWanted.input.setSources(['keyboard']);
    notWanted.input.setSources(['keyboard', 'touchStick']);
    expect(notWanted.controls.root.hidden).toBe(true);
  });

  it('a touch while touch is off makes the controls wanted for later', () => {
    const { input, controls, target } = setUp({ touch: false });
    input.setSources(['keyboard']);
    target.dispatchEvent(new Event('touchstart'));
    expect(controls.root.hidden).toBe(true);
    input.setSources(['keyboard', 'touchStick']);
    expect(controls.root.hidden).toBe(false);
  });

  it('accepts the sources that come later and ignores them', () => {
    const { input, press } = setUp();
    expect(() => input.setSources(['keyboard', 'pointerDrag', 'gamepad'])).not.toThrow();
    press('KeyD');
    expect(input.flight().turn).toBe(1);
  });
});

describe('actions', () => {
  it('has the keys from the design', () => {
    expect(ACTION_KEYS).toEqual({
      boost: ['Space'],
      starMap: ['KeyM'],
      menu: ['Escape'],
      back: ['Escape'],
      confirm: ['Enter', 'NumpadEnter'],
      listen: [],
    });
    expect(actionsForKey('Escape')).toEqual(['menu', 'back']);
    expect(actionsForKey('KeyQ')).toEqual([]);
  });

  function recorder(input: ReturnType<typeof setUp>['input']) {
    const heard: Action[] = [];
    for (const a of Object.keys(ACTION_KEYS) as Action[]) input.onAction(a, () => heard.push(a));
    return heard;
  }

  it('fires the action for each key, once per press', () => {
    const { input, press } = setUp();
    const heard = recorder(input);
    press('KeyM');
    press('Escape');
    press('Enter');
    press('NumpadEnter');
    press('Space');
    expect(heard).toEqual(['starMap', 'menu', 'back', 'confirm', 'confirm', 'boost']);
  });

  it('does not fire on a repeat, with a modifier, or while covered', () => {
    let blocked = false;
    const { input, press } = setUp({ blocked: () => blocked });
    const heard = recorder(input);
    press('KeyM', { repeat: true });
    press('KeyM', { ctrlKey: true });
    press('Enter', { metaKey: true });
    press('Escape', { altKey: true });
    blocked = true;
    press('Escape');
    expect(heard).toEqual([]);
  });

  it('does not fire boost for Space on a focused button', () => {
    const { input, press } = setUp();
    const heard = recorder(input);
    press('Space', { target: { closest: () => ({}) } });
    expect(heard).toEqual([]);
  });

  it('never stops the browser default for an action key', () => {
    const { input, press } = setUp();
    recorder(input);
    for (const code of ['KeyM', 'Escape', 'Enter', 'NumpadEnter']) expect(press(code).defaultPrevented).toBe(false);
  });

  it('fires boost when the BOOST button is pressed', () => {
    const { input, controls } = setUp({ touch: true });
    const heard = recorder(input);
    controls.boost.dispatchEvent(pointer('pointerdown', 1));
    expect(heard).toEqual(['boost']);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const { input, press } = setUp();
    const fn = vi.fn();
    const off = input.onAction('starMap', fn);
    press('KeyM');
    off();
    press('KeyM');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops listening after dispose', () => {
    const { input, press } = setUp();
    const fn = vi.fn();
    input.onAction('starMap', fn);
    (input as { dispose(): void }).dispose();
    press('KeyM');
    press('ArrowLeft');
    expect(fn).not.toHaveBeenCalled();
    expect(input.flight().turn).toBe(0);
  });
});
