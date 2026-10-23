import { applyDrag, stepLook, wrapDegrees, type LookInput, type LookState } from './geometry';

const TURN_SPEED = 240; // degrees per second when a dot pulls the view round to itself

/** Owns where you are looking. Keys and the glowing dots move it; dragging the picture moves it too. */
export class LookController {
  state: LookState;
  private target: LookState | null = null;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private cleanup: (() => void) | undefined;

  constructor(start: LookState) {
    this.state = { ...start };
  }

  /** Lets people drag or swipe the picture on `element`. */
  attach(element: HTMLElement, viewHeight: () => number, verticalFov: number): void {
    this.detach();
    const down = (e: PointerEvent) => {
      this.dragging = true;
      this.target = null;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; dragging still works while it moves over the picture.
      }
    };
    const move = (e: PointerEvent) => {
      if (!this.dragging) return;
      this.state = applyDrag(this.state, e.clientX - this.lastX, e.clientY - this.lastY, {
        verticalFovDegrees: verticalFov,
        viewportHeight: viewHeight(),
      });
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const up = () => {
      this.dragging = false;
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('lostpointercapture', up);
    this.cleanup = () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.removeEventListener('lostpointercapture', up);
    };
  }

  detach(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.dragging = false;
  }

  /** Swings the view round to a direction (or jumps there, if motion is reduced). */
  turnTo(azimuth: number, elevation: number, instant: boolean): void {
    if (instant) {
      this.state = { azimuth: wrapDegrees(azimuth), elevation };
      this.target = null;
    } else {
      this.target = { azimuth: wrapDegrees(azimuth), elevation };
    }
  }

  step(dt: number, input: LookInput): void {
    if (input.turn !== 0 || input.tilt !== 0) this.target = null; // the player took over
    if (this.target) {
      const maxStep = Math.min(dt, 0.1) * TURN_SPEED;
      const diff = ((this.target.azimuth - this.state.azimuth + 540) % 360) - 180; // shortest way round
      const elevationDiff = this.target.elevation - this.state.elevation;
      const move = (d: number) => Math.sign(d) * Math.min(Math.abs(d), maxStep);
      this.state = { azimuth: wrapDegrees(this.state.azimuth + move(diff)), elevation: this.state.elevation + move(elevationDiff) };
      if (Math.abs(diff) < 0.2 && Math.abs(elevationDiff) < 0.2) this.target = null;
      return;
    }
    this.state = stepLook(this.state, input, dt);
  }
}
