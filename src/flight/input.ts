import type { FlightInput } from './flightModel';

const KEYS: Record<string, 'left' | 'right' | 'up' | 'down' | 'boost'> = {
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

const DEAD_ZONE = 0.15;

/**
 * Turns keyboard and touch into one FlightInput.
 * Keyboard: WASD or arrows (up = nose up), Space = boost.
 * Touch: a joystick on the left (drag up = nose up) and a boost button on the right.
 */
export class InputController {
  private readonly held = new Set<string>();
  private stick = { x: 0, y: 0 };
  private boostButton = false;
  private readonly touchRoot: HTMLElement;
  private touchWanted: boolean;
  private touchSuspended = false;

  /**
   * `isBlocked` says when something is covering the game (the settings panel): steering and boost keys
   * are then ignored, so the rocket does not fly around behind it.
   */
  constructor(
    parent: HTMLElement,
    showTouchControls: boolean,
    private readonly isBlocked: () => boolean = () => false,
  ) {
    window.addEventListener('keydown', (e) => {
      if (!(e.code in KEYS)) return;
      if (this.isBlocked()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts like Cmd+D and Cmd+S alone
      if (e.target instanceof HTMLElement && e.target.closest('button') && e.code === 'Space') return; // let Space press a focused button
      e.preventDefault();
      this.held.add(KEYS[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code in KEYS) this.held.delete(KEYS[e.code]);
    });
    // If the window loses focus or the tab is hidden we may never hear a key or finger come up, so let go of everything.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    this.touchRoot = document.createElement('div');
    this.touchRoot.className = 'touch-controls';
    this.touchWanted = showTouchControls;
    this.touchRoot.hidden = !showTouchControls;
    this.touchRoot.innerHTML = `
      <div class="stick" data-testid="stick" aria-label="Steering stick"><div class="stick-thumb"></div></div>
      <button class="boost-button" data-testid="boost-button" type="button">BOOST</button>`;
    parent.appendChild(this.touchRoot);
    this.setUpStick(this.touchRoot.querySelector('.stick') as HTMLElement);
    this.setUpBoost(this.touchRoot.querySelector('.boost-button') as HTMLElement);

    // If a touch happens on a device we did not expect, show the controls.
    window.addEventListener('touchstart', () => this.showTouchControls(), { once: true, passive: true });
  }

  showTouchControls(): void {
    this.touchWanted = true;
    this.touchRoot.hidden = this.touchSuspended;
  }

  /** Hides the stick and boost button while something else (a surface scene) is using the screen. */
  suspendTouchControls(suspended: boolean): void {
    this.touchSuspended = suspended;
    this.touchRoot.hidden = suspended || !this.touchWanted;
    if (suspended) this.releaseAll();
  }

  private readonly releaseHandlers: Array<() => void> = [];

  private releaseAll(): void {
    this.held.clear();
    for (const release of this.releaseHandlers) release();
  }

  /** True while the player is steering (used to cancel autopilot). */
  isSteering(): boolean {
    if (this.isBlocked()) return false;
    const h = this.held;
    return h.has('left') || h.has('right') || h.has('up') || h.has('down') || Math.hypot(this.stick.x, this.stick.y) > DEAD_ZONE;
  }

  read(): FlightInput {
    if (this.isBlocked()) return { turn: 0, pitch: 0, boost: false };
    const h = this.held;
    const keyTurn = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
    const keyPitch = (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0);
    const stickActive = Math.hypot(this.stick.x, this.stick.y) > DEAD_ZONE;
    return {
      turn: keyTurn !== 0 ? keyTurn : stickActive ? this.stick.x : 0,
      pitch: keyPitch !== 0 ? keyPitch : stickActive ? -this.stick.y : 0,
      boost: h.has('boost') || this.boostButton,
    };
  }

  private setUpStick(el: HTMLElement): void {
    const thumb = el.querySelector('.stick-thumb') as HTMLElement;
    let activeId: number | null = null;
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    const move = (e: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const radius = box.width / 2;
      let dx = (e.clientX - (box.left + radius)) / radius;
      let dy = (e.clientY - (box.top + radius)) / radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.stick = { x: dx, y: dy };
      thumb.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    };
    const letGo = () => {
      activeId = null;
      this.stick = { x: 0, y: 0 };
      thumb.style.transform = 'translate(0, 0)';
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId === activeId) letGo();
    };
    this.releaseHandlers.push(letGo);

    el.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      capture(el, e.pointerId);
      move(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === activeId) move(e);
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  private setUpBoost(el: HTMLElement): void {
    // Only the finger that pressed the button can let it go: a second finger lifting must not stop the boost.
    let activeId: number | null = null;
    const off = () => {
      activeId = null;
      this.boostButton = false;
      el.classList.remove('is-down');
    };
    const release = (e: PointerEvent) => {
      if (e.pointerId === activeId) off();
    };
    this.releaseHandlers.push(off);

    el.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      capture(el, e.pointerId);
      this.boostButton = true;
      el.classList.add('is-down');
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

/** Keeps a finger attached to a control even if it slides off. Some browsers refuse; the control still works without it. */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // The pointer is already gone, or capture is not available.
  }
}
