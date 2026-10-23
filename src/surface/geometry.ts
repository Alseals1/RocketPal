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
  const positive = wrapped < 0 ? wrapped + 360 : wrapped;
  return positive >= 360 ? 0 : positive === 0 ? 0 : positive; // a tiny negative number must not round up to 360
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

/** A normal wide photo (not a panorama): how wide the lens saw, and the photo's width divided by its height. */
export interface RectilinearPhoto {
  horizontalFov: number;
  aspect: number;
}

/**
 * Where a point in an ordinary wide photo is, as an azimuth and elevation. `x` and `y` are fractions of the photo width
 * and height (0, 0 is the top left corner). `centerAzimuth` is the way the middle of the photo faces. A normal photo shows
 * straight lines straight, so a point's angle is worked out from how far it is across and up the flat picture, with the
 * lens sitting in front of the middle of the picture at the distance that gives the right field of view.
 */
export function rectilinearPhotoToAzEl(
  x: number,
  y: number,
  photo: RectilinearPhoto,
  centerAzimuth = 0,
): { azimuth: number; elevation: number } {
  const across = x - 0.5; // in photo widths, right is positive
  const up = (0.5 - y) / photo.aspect; // in photo widths, up is positive
  const lens = 0.5 / Math.tan((photo.horizontalFov * DEG) / 2); // distance from the lens to the picture, in photo widths
  return {
    azimuth: wrapDegrees(centerAzimuth + Math.atan2(across, lens) / DEG),
    elevation: Math.atan2(up, Math.hypot(lens, across)) / DEG,
  };
}

/** How wide a screen sees, given how tall it sees and the screen's width divided by its height. */
export function viewHorizontalFov(verticalFov: number, screenAspect: number): number {
  return (2 * Math.atan(Math.tan((verticalFov * DEG) / 2) * screenAspect)) / DEG;
}

/** How wide and how tall something is seen, in degrees. */
interface Fovs {
  horizontalFov: number;
  verticalFov: number;
}

/**
 * Does every corner of the screen land on the flat photo when looking `yaw` degrees to the side of the middle of the photo
 * and `pitch` degrees up? The photo hangs flat in front of the camera, so a ray that leaves the camera at an angle meets the
 * plane further up and out than the straight-ahead ray does (by 1 / cos of the angle). That is why "the photo's angle minus the
 * screen's angle" is exact only along the middle row, and a corner can poke past the edge when you look to the side.
 * The photo is measured at distance 1: half as wide as tan(horizontal field of view / 2), and likewise for the height.
 */
export function windowCornersInside(photo: Fovs, view: Fovs, yaw: number, pitch: number): boolean {
  const psi = yaw * DEG;
  const theta = pitch * DEG;
  const forward = { x: Math.cos(psi) * Math.cos(theta), y: Math.sin(theta), z: Math.sin(psi) * Math.cos(theta) };
  const right = { x: -Math.sin(psi), y: 0, z: Math.cos(psi) };
  const up = { x: -Math.cos(psi) * Math.sin(theta), y: Math.cos(theta), z: -Math.sin(psi) * Math.sin(theta) };
  const reachAcross = Math.tan((view.horizontalFov * DEG) / 2);
  const reachUp = Math.tan((view.verticalFov * DEG) / 2);
  const halfWidth = Math.tan((photo.horizontalFov * DEG) / 2);
  const halfHeight = Math.tan((photo.verticalFov * DEG) / 2);
  const tolerance = 1e-9;
  for (const sideways of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      const ray = {
        x: forward.x + sideways * reachAcross * right.x + vertical * reachUp * up.x,
        y: forward.y + sideways * reachAcross * right.y + vertical * reachUp * up.y,
        z: forward.z + sideways * reachAcross * right.z + vertical * reachUp * up.z,
      };
      if (ray.x <= tolerance) return false; // looking away from the photo
      if (Math.abs(ray.z / ray.x) > halfWidth + tolerance) return false;
      if (Math.abs(ray.y / ray.x) > halfHeight + tolerance) return false;
    }
  }
  return true;
}

/** The biggest value up to `max` for which `works` is true, found by halving (assumes smaller values are always safer). */
function largestThatWorks(max: number, works: (value: number) => boolean): number {
  if (max <= 0) return 0;
  if (works(max)) return max;
  let low = 0;
  let high = max;
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2;
    if (works(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/**
 * How tall the camera should see in a window view. Normally 50 degrees, but it zooms in when needed so that
 *   (1) a screen wider than the photo does not show black bars (the screen sees exactly the photo's full width and no more), and
 *   (2) every corner of the screen stays on the photo even when you look as far sideways as the photo allows.
 */
export function windowCameraFov(photo: Fovs, screenAspect: number, maxVerticalFov = 50): number {
  const aspect = Math.max(0.01, screenAspect);
  const fillsWidth = (2 * Math.atan(Math.tan((photo.horizontalFov * DEG) / 2) / aspect)) / DEG;
  const reachesWholePhoto = (verticalFov: number): boolean => {
    const view = { horizontalFov: viewHorizontalFov(verticalFov, aspect), verticalFov };
    const fullSideways = Math.max(0, (photo.horizontalFov - view.horizontalFov) / 2);
    return windowCornersInside(photo, view, fullSideways, 0) && windowCornersInside(photo, view, -fullSideways, 0);
  };
  return Math.max(10, largestThatWorks(Math.min(maxVerticalFov, fillsWidth), reachesWholePhoto));
}

export interface LookLimits {
  /** The way the middle of the picture faces. */
  azimuthCenter: number;
  /** How far either side of the middle you may look. */
  azimuthHalfRange: number;
  minElevation: number;
  maxElevation: number;
}

/**
 * How far you may look round inside a window picture so that no corner of the screen ever leaves the photo. Found from the
 * exact corner geometry (see `windowCornersInside`): first as far sideways as stays safe, then as far up and down as stays safe
 * at that sideways limit. A screen that cannot fit on the photo even looking straight at it has nothing to look round.
 */
export function windowLookLimits(photo: Fovs, view: Fovs, centerAzimuth: number): LookLimits {
  const none: LookLimits = { azimuthCenter: centerAzimuth, azimuthHalfRange: 0, minElevation: 0, maxElevation: 0 };
  if (!windowCornersInside(photo, view, 0, 0)) return none;
  const reachSideways = Math.max(0, (photo.horizontalFov - view.horizontalFov) / 2);
  const reachUp = Math.max(0, (photo.verticalFov - view.verticalFov) / 2);
  const yaw = largestThatWorks(reachSideways, (y) => windowCornersInside(photo, view, y, 0) && windowCornersInside(photo, view, -y, 0));
  const pitch = largestThatWorks(reachUp, (p) =>
    [yaw, -yaw].every((y) => windowCornersInside(photo, view, y, p) && windowCornersInside(photo, view, y, -p)),
  );
  return { azimuthCenter: centerAzimuth, azimuthHalfRange: yaw, minElevation: -pitch, maxElevation: pitch };
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

/** Keeps a view inside the limits (azimuth is measured the short way round from the middle of the picture). */
export function clampLook(state: LookState, limits?: LookLimits): LookState {
  return keepInside(state.azimuth, state.elevation, limits);
}

function keepInside(azimuth: number, elevation: number, limits?: LookLimits): LookState {
  if (!limits) {
    return {
      azimuth: wrapDegrees(azimuth),
      elevation: clamp(elevation, LOOK_LIMITS.minElevation, LOOK_LIMITS.maxElevation),
    };
  }
  const fromMiddle = ((azimuth - limits.azimuthCenter + 540) % 360) - 180; // -180 to 180
  return {
    azimuth: wrapDegrees(limits.azimuthCenter + clamp(fromMiddle, -limits.azimuthHalfRange, limits.azimuthHalfRange)),
    elevation: clamp(elevation, limits.minElevation, limits.maxElevation),
  };
}

export function stepLook(state: LookState, input: LookInput, dt: number, limits?: LookLimits): LookState {
  const step = clamp(dt, 0, MAX_DT) * LOOK_SPEED;
  return keepInside(
    state.azimuth + clamp(input.turn, -1, 1) * step,
    state.elevation + clamp(input.tilt, -1, 1) * step,
    limits,
  );
}

export interface ViewSize {
  verticalFovDegrees: number;
  viewportHeight: number;
}

/** Dragging moves the picture with the finger, so the view turns the opposite way. `dx`, `dy` are in pixels. */
export function applyDrag(state: LookState, dx: number, dy: number, view: ViewSize, limits?: LookLimits): LookState {
  const degreesPerPixel = view.verticalFovDegrees / Math.max(1, view.viewportHeight);
  return keepInside(state.azimuth - dx * degreesPerPixel, state.elevation + dy * degreesPerPixel, limits);
}
