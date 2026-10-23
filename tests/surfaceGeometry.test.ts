import { describe, it, expect } from 'vitest';
import {
  azElToDirection,
  directionToAzEl,
  cylindricalPhotoToAzEl,
  stepLook,
  applyDrag,
  wrapDegrees,
  LOOK_LIMITS,
  type LookState,
} from '../src/surface/geometry';

describe('azElToDirection', () => {
  it('points along +X at azimuth 0 and +Z at azimuth 90, level with the horizon', () => {
    const a = azElToDirection(0, 0);
    expect(a.x).toBeCloseTo(1, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.z).toBeCloseTo(0, 6);
    const b = azElToDirection(90, 0);
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.z).toBeCloseTo(1, 6);
  });

  it('points straight up at elevation 90 and straight down at -90', () => {
    expect(azElToDirection(123, 90).y).toBeCloseTo(1, 6);
    expect(azElToDirection(123, -90).y).toBeCloseTo(-1, 6);
  });

  it('always has length 1', () => {
    for (const [az, el] of [[10, 20], [200, -45], [359, 80], [0, 0]]) {
      const d = azElToDirection(az, el);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
    }
  });

  it('turning right (more azimuth) swings the view from +X toward +Z, which is clockwise seen from above', () => {
    // Seen from above (looking down -Y), going from +X toward +Z is a clockwise turn.
    const before = azElToDirection(0, 0);
    const after = azElToDirection(10, 0);
    const crossY = before.z * after.x - before.x * after.z; // y part of before x after
    expect(crossY).toBeLessThan(0); // negative turn about +Y = clockwise from above
  });
});

describe('directionToAzEl', () => {
  it('undoes azElToDirection, with azimuth in 0 to 360', () => {
    for (const [az, el] of [[10, 20], [200, -45], [359, 80], [0, 0], [180, -10]]) {
      const back = directionToAzEl(azElToDirection(az, el));
      expect(back.azimuth).toBeCloseTo(az, 6);
      expect(back.elevation).toBeCloseTo(el, 6);
    }
  });
});

describe('cylindricalPhotoToAzEl (the NASA photo: 9238 x 2451, horizon 8.8% from the top)', () => {
  const photo = { aspect: 9238 / 2451, horizon: 0.088 };

  it('maps the width of the photo to one full turn', () => {
    expect(cylindricalPhotoToAzEl(0, 0.5, photo).azimuth).toBeCloseTo(0, 6);
    expect(cylindricalPhotoToAzEl(0.25, 0.5, photo).azimuth).toBeCloseTo(90, 6);
    expect(cylindricalPhotoToAzEl(0.75, 0.5, photo).azimuth).toBeCloseTo(270, 6);
  });

  it('puts the horizon row at elevation 0', () => {
    expect(cylindricalPhotoToAzEl(0.3, 0.088, photo).elevation).toBeCloseTo(0, 6);
  });

  it('covers about +8.4 degrees at the top edge and -56.7 degrees at the bottom edge', () => {
    // Worked by hand: one turn = 9238 px wide, so f = 9238 / (2 pi) = 1470.3 px. The top edge is 0.088 x 2451 = 215.7 px
    // above the horizon: atan(215.7 / 1470.3) = 8.35 degrees. The bottom edge is 2235.3 px below: atan(2235.3 / 1470.3) = 56.7.
    expect(cylindricalPhotoToAzEl(0.5, 0, photo).elevation).toBeCloseTo(8.35, 1);
    expect(cylindricalPhotoToAzEl(0.5, 1, photo).elevation).toBeCloseTo(-56.67, 1);
  });
});

describe('wrapDegrees', () => {
  it('keeps angles in 0 to 360', () => {
    expect(wrapDegrees(370)).toBeCloseTo(10, 9);
    expect(wrapDegrees(-10)).toBeCloseTo(350, 9);
    expect(wrapDegrees(0)).toBe(0);
    expect(wrapDegrees(360)).toBe(0);
  });
});

/** Holds an input for some seconds, one 60 fps frame at a time, like the game does. */
function hold(state: LookState, input: { turn: number; tilt: number }, seconds: number): LookState {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) s = stepLook(s, input, 1 / 60);
  return s;
}

describe('looking around', () => {
  const start: LookState = { azimuth: 100, elevation: 0 };
  const idle = { turn: 0, tilt: 0 };

  it('turns right with the right key and left with the left key, at a steady speed', () => {
    const right = hold(start, { turn: 1, tilt: 0 }, 1);
    const left = hold(start, { turn: -1, tilt: 0 }, 1);
    expect(right.azimuth).toBeGreaterThan(start.azimuth + 30);
    expect(left.azimuth).toBeLessThan(start.azimuth - 30);
    expect(right.azimuth - start.azimuth).toBeCloseTo(start.azimuth - left.azimuth, 6);
  });

  it('does not move when nothing is pressed', () => {
    expect(stepLook(start, idle, 1)).toEqual(start);
  });

  it('wraps round past north and never goes negative', () => {
    const near: LookState = { azimuth: 355, elevation: 0 };
    const turned = hold(near, { turn: 1, tilt: 0 }, 1);
    expect(turned.azimuth).toBeGreaterThanOrEqual(0);
    expect(turned.azimuth).toBeLessThan(180);
    const back = hold({ azimuth: 5, elevation: 0 }, { turn: -1, tilt: 0 }, 1);
    expect(back.azimuth).toBeGreaterThan(180);
  });

  it('tilts up and down, and stops at the limits so the picture never flips over', () => {
    const up = hold(start, { turn: 0, tilt: 1 }, 5);
    const down = hold(start, { turn: 0, tilt: -1 }, 5);
    expect(up.elevation).toBe(LOOK_LIMITS.maxElevation);
    expect(down.elevation).toBe(LOOK_LIMITS.minElevation);
    expect(LOOK_LIMITS.maxElevation).toBeLessThan(90);
    expect(LOOK_LIMITS.minElevation).toBeGreaterThan(-90);
  });

  it('ignores a long pause between frames: no huge jump', () => {
    const jumped = stepLook(start, { turn: 1, tilt: 0 }, 10);
    const normal = stepLook(start, { turn: 1, tilt: 0 }, 0.1);
    expect(jumped.azimuth - start.azimuth).toBeCloseTo(normal.azimuth - start.azimuth, 6);
  });
});

describe('dragging the picture', () => {
  const start: LookState = { azimuth: 100, elevation: 0 };
  const view = { verticalFovDegrees: 70, viewportHeight: 700 }; // 0.1 degree per pixel

  it('drags the picture along with the finger: finger right means the view turns left', () => {
    const dragged = applyDrag(start, 100, 0, view);
    expect(dragged.azimuth).toBeCloseTo(90, 6);
  });

  it('finger down means the view tilts up, and finger up means it tilts down', () => {
    expect(applyDrag(start, 0, 100, view).elevation).toBeCloseTo(10, 6);
    expect(applyDrag(start, 0, -100, view).elevation).toBeCloseTo(-10, 6);
  });

  it('keeps within the limits and wraps azimuth', () => {
    expect(applyDrag(start, 0, 100000, view).elevation).toBe(LOOK_LIMITS.maxElevation);
    expect(applyDrag({ azimuth: 5, elevation: 0 }, 200, 0, view).azimuth).toBeCloseTo(345, 6);
  });
});
