/**
 * The maths of standing inside a 360 degree picture.
 *
 * Directions use two angles, in degrees:
 *   azimuth   0 to 360, round the horizon. Azimuth 0 is the left edge of the picture (and also its right edge). Going up in
 *             azimuth turns to the right (clockwise seen from above).
 *   elevation -90 to 90, 0 is the horizon, positive is up.
 */
import type { Vec3 } from '../flight/flightModel';

const DEG = Math.PI / 180;

/** The unit direction for an azimuth and elevation. The picture is wrapped round a sphere with exactly this layout. */
export function azElToDirection(azimuthDegrees: number, elevationDegrees: number): Vec3 {
  const az = azimuthDegrees * DEG;
  const el = elevationDegrees * DEG;
  return { x: Math.cos(az) * Math.cos(el), y: Math.sin(el), z: Math.sin(az) * Math.cos(el) };
}

export function wrapDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped === 0 ? 0 : wrapped;
}

export function directionToAzEl(direction: Vec3): { azimuth: number; elevation: number } {
  const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
  return {
    azimuth: wrapDegrees(Math.atan2(direction.z, direction.x) / DEG),
    elevation: Math.asin(Math.max(-1, Math.min(1, direction.y / length))) / DEG,
  };
}

/** Describes a cylindrical panorama photo: its width divided by its height, and where the horizon is (0 = top, 1 = bottom). */
export interface CylindricalPhoto {
  aspect: number;
  horizon: number;
}

/**
 * Where a point in a cylindrical panorama photo is, as an azimuth and elevation. `x` and `y` are fractions of the photo
 * width and height (0, 0 is the top left corner). In a cylindrical photo one full turn spans the width, so one unit of
 * height is `aspect / (2 pi)` as many radians as the width is for one turn.
 */
export function cylindricalPhotoToAzEl(x: number, y: number, photo: CylindricalPhoto): { azimuth: number; elevation: number } {
  const focal = photo.aspect / (2 * Math.PI); // in picture heights
  return {
    azimuth: wrapDegrees(x * 360),
    elevation: Math.atan((photo.horizon - y) / focal) / DEG,
  };
}

export interface LookState {
  azimuth: number;
  elevation: number;
}

export interface LookInput {
  /** -1 left .. +1 right. */
  turn: number;
  /** -1 down .. +1 up. */
  tilt: number;
}

export const LOOK_LIMITS = { minElevation: -60, maxElevation: 75 } as const;
/** Degrees per second when a key is held. */
const LOOK_SPEED = 60;
/** Longest frame we trust, so a hiccup does not fling the view round. */
const MAX_DT = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function stepLook(state: LookState, input: LookInput, dt: number): LookState {
  const step = clamp(dt, 0, MAX_DT) * LOOK_SPEED;
  return {
    azimuth: wrapDegrees(state.azimuth + clamp(input.turn, -1, 1) * step),
    elevation: clamp(state.elevation + clamp(input.tilt, -1, 1) * step, LOOK_LIMITS.minElevation, LOOK_LIMITS.maxElevation),
  };
}

export interface ViewSize {
  verticalFovDegrees: number;
  viewportHeight: number;
}

/** Dragging moves the picture with the finger, so the view turns the opposite way. `dx`, `dy` are in pixels. */
export function applyDrag(state: LookState, dx: number, dy: number, view: ViewSize): LookState {
  const degreesPerPixel = view.verticalFovDegrees / Math.max(1, view.viewportHeight);
  return {
    azimuth: wrapDegrees(state.azimuth - dx * degreesPerPixel),
    elevation: clamp(state.elevation + dy * degreesPerPixel, LOOK_LIMITS.minElevation, LOOK_LIMITS.maxElevation),
  };
}
