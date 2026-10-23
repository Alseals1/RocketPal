import { describe, it, expect } from 'vitest';
import {
  azElToDirection,
  directionToAzEl,
  cylindricalPhotoToAzEl,
  stepLook,
  applyDrag,
  wrapDegrees,
  LOOK_LIMITS,
  rectilinearPhotoToAzEl,
  viewHorizontalFov,
  windowCameraFov,
  windowCornersInside,
  windowLookLimits,
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
  it('never returns 360 itself, even for a tiny negative number (rounding)', () => {
    expect(wrapDegrees(-1e-15)).toBeLessThan(360);
    expect(wrapDegrees(-1e-15)).toBeGreaterThanOrEqual(0);
  });

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

describe('rectilinearPhotoToAzEl (an ordinary wide photo: 24 mm lens on a full-frame camera, 3:2)', () => {
  // The lens sees 2 x atan(18/24) = 73.74 degrees across and 2 x atan(12/24) = 53.13 degrees up and down.
  // Worked by hand with the width of the photo as 1: the lens is 0.6667 widths from the picture, because
  // tan(36.87 degrees) = 0.75 and 0.5 / 0.75 = 0.6667.
  const photo = { horizontalFov: 73.7398, aspect: 1.5 };

  it('puts the middle of the photo straight ahead', () => {
    const a = rectilinearPhotoToAzEl(0.5, 0.5, photo);
    expect(a.azimuth).toBeCloseTo(0, 4);
    expect(a.elevation).toBeCloseTo(0, 4);
  });

  it('puts the right and left edges 36.87 degrees to either side', () => {
    expect(rectilinearPhotoToAzEl(1, 0.5, photo).azimuth).toBeCloseTo(36.87, 2);
    expect(rectilinearPhotoToAzEl(0, 0.5, photo).azimuth).toBeCloseTo(360 - 36.87, 2);
  });

  it('puts the top edge 26.57 degrees up (a photo 53.13 degrees tall)', () => {
    expect(rectilinearPhotoToAzEl(0.5, 0, photo).elevation).toBeCloseTo(26.565, 2);
    expect(rectilinearPhotoToAzEl(0.5, 1, photo).elevation).toBeCloseTo(-26.565, 2);
  });

  it('puts a corner lower than the edge middle, as a flat photo does (21.80 degrees up at the corner)', () => {
    const corner = rectilinearPhotoToAzEl(1, 0, photo);
    expect(corner.azimuth).toBeCloseTo(36.87, 2);
    expect(corner.elevation).toBeCloseTo(21.8, 2);
  });

  it('bends angles the way a flat photo does: halfway to the edge is NOT halfway in angle', () => {
    // A quarter of the width right of the middle: atan(0.25 / 0.6667) = atan(0.375) = 20.56 degrees,
    // more than the straight-line guess of half of 36.87 = 18.43. (Only at the very edge do the two agree.)
    expect(rectilinearPhotoToAzEl(0.75, 0.5, photo).azimuth).toBeCloseTo(20.556, 2);
    // A sixth of the width up from the middle (y = 0.25): atan(0.1667 / 0.6667) = atan(0.25) = 14.04 degrees.
    expect(rectilinearPhotoToAzEl(0.5, 0.25, photo).elevation).toBeCloseTo(14.036, 2);
  });

  it('turns everything round when the photo faces another way', () => {
    expect(rectilinearPhotoToAzEl(0.5, 0.5, photo, 90).azimuth).toBeCloseTo(90, 4);
    expect(rectilinearPhotoToAzEl(1, 0.5, photo, 90).azimuth).toBeCloseTo(126.87, 2);
  });
});

describe('what the screen shows of a window picture', () => {
  it('works out the sideways field of view from the up-and-down one and the screen shape', () => {
    expect(viewHorizontalFov(50, 1)).toBeCloseTo(50, 6); // a square screen
    // 16:9: tan(25 degrees) = 0.46631, times 1.77778 = 0.82899, atan = 39.66 degrees, twice that.
    expect(viewHorizontalFov(50, 16 / 9)).toBeCloseTo(79.32, 1);
  });

  const photo = { horizontalFov: 73.74, verticalFov: 53.13 };

  it('does not let you look past the edge of the picture on a wide screen: nothing to look round', () => {
    const wide = windowLookLimits(photo, { horizontalFov: viewHorizontalFov(50, 16 / 9), verticalFov: 50 }, 0);
    expect(wide.azimuthHalfRange).toBe(0); // the screen is already wider than the photo
  });

  it('keeps the centre of the picture as the middle of the range', () => {
    expect(windowLookLimits(photo, { horizontalFov: 30, verticalFov: 30 }, 90).azimuthCenter).toBe(90);
  });
});

describe('looking round inside limits', () => {
  const limits = { azimuthCenter: 0, azimuthHalfRange: 20, minElevation: -5, maxElevation: 5 };
  const hold = (state: LookState, input: { turn: number; tilt: number }, seconds: number): LookState => {
    let st = state;
    for (let t = 0; t < seconds; t += 1 / 60) st = stepLook(st, input, 1 / 60, limits);
    return st;
  };

  it('stops turning right at the edge of the picture', () => {
    expect(hold({ azimuth: 0, elevation: 0 }, { turn: 1, tilt: 0 }, 10).azimuth).toBeCloseTo(20, 6);
  });

  it('stops turning left at the other edge, across the wrap-around', () => {
    expect(hold({ azimuth: 0, elevation: 0 }, { turn: -1, tilt: 0 }, 10).azimuth).toBeCloseTo(340, 6);
  });

  it('stops tilting at the top and bottom', () => {
    expect(hold({ azimuth: 0, elevation: 0 }, { turn: 0, tilt: 1 }, 10).elevation).toBe(5);
    expect(hold({ azimuth: 0, elevation: 0 }, { turn: 0, tilt: -1 }, 10).elevation).toBe(-5);
  });

  it('pulls a view that starts outside the limits back inside', () => {
    expect(stepLook({ azimuth: 90, elevation: 40 }, { turn: 0, tilt: 0 }, 1 / 60, limits)).toEqual({ azimuth: 20, elevation: 5 });
  });

  it('holds still when there is no room to look round at all', () => {
    const none = { azimuthCenter: 0, azimuthHalfRange: 0, minElevation: 0, maxElevation: 0 };
    const moved = stepLook({ azimuth: 0, elevation: 0 }, { turn: 1, tilt: 1 }, 1 / 60, none);
    expect(moved).toEqual({ azimuth: 0, elevation: 0 });
  });

  it('applies the same limits to dragging', () => {
    const view = { verticalFovDegrees: 70, viewportHeight: 700 };
    expect(applyDrag({ azimuth: 0, elevation: 0 }, -5000, 0, view, limits).azimuth).toBeCloseTo(20, 6);
    expect(applyDrag({ azimuth: 0, elevation: 0 }, 5000, 0, view, limits).azimuth).toBeCloseTo(340, 6);
    expect(applyDrag({ azimuth: 0, elevation: 0 }, 0, 5000, view, limits).elevation).toBe(5);
  });
});

describe('windowCornersInside: do all four corners of the screen land on the flat photo?', () => {
  // The photo (24 mm lens): 73.74 x 53.13 degrees, so at distance 1 it is 1.5 wide (half 0.75) and 1.0 tall (half 0.5).
  // A phone screen 9:16 with the camera seeing 50 degrees up and down: half-height tan(25 degrees) = 0.46631,
  // half-width 0.46631 x 0.5625 = 0.26231 (29.4 degrees across).
  const photo = { horizontalFov: 73.7398, verticalFov: 53.1301 };
  const phone = { horizontalFov: viewHorizontalFov(50, 9 / 16), verticalFov: 50 };

  it('is true looking straight at the middle', () => {
    expect(windowCornersInside(photo, phone, 0, 0)).toBe(true);
  });

  it('is true turned 10 degrees: the top corner reaches 0.46631 / (cos 10 - 0.26231 sin 10) = 0.4965, inside the 0.5 edge', () => {
    expect(windowCornersInside(photo, phone, 10, 0)).toBe(true);
    expect(windowCornersInside(photo, phone, -10, 0)).toBe(true);
  });

  it('is false at 22.17 degrees, where the old rule said you could look: the corner reaches 0.46631 / 0.8270 = 0.564, past 0.5', () => {
    expect(windowCornersInside(photo, phone, 22.17, 0)).toBe(false);
  });

  it('is false when the photo is too small to cover the screen even looking straight at it', () => {
    expect(windowCornersInside({ horizontalFov: 30, verticalFov: 20 }, phone, 0, 0)).toBe(false);
  });

  it('is false when looking too far up', () => {
    expect(windowCornersInside(photo, { horizontalFov: 70, verticalFov: 50 }, 0, 2)).toBe(false);
  });
});

describe('windowLookLimits: exactly as far as the screen stays on the photo', () => {
  const photo = { horizontalFov: 73.7398, verticalFov: 53.1301 };

  it('on a 9:16 phone at 50 degrees, the sideways limit is 10.87 degrees, not the old 22.17', () => {
    // Worked by hand: the corner stays inside while cos(a) - 0.26231 sin(a) >= 0.46631 / 0.5 = 0.93262.
    // cos(a) - 0.26231 sin(a) = 1.0338 cos(a + 14.70), so a + 14.70 <= acos(0.93262 / 1.0338) = 25.57, so a <= 10.87.
    const limits = windowLookLimits(photo, { horizontalFov: viewHorizontalFov(50, 9 / 16), verticalFov: 50 }, 0);
    expect(limits.azimuthHalfRange).toBeCloseTo(10.87, 1);
    expect(limits.maxElevation).toBeCloseTo(0, 1); // no room up or down once the corners touch the top and bottom edges
  });

  it('on a wide screen where the photo exactly fills the width there is nothing to look round at all', () => {
    // Tilt by an angle t and the top corners reach out to 0.75 / (cos t - 0.42187 sin t): wider than the photo's 0.75 half-width.
    // (0.42187 is the half-height of that screen.) So a photo that exactly fills the screen cannot be moved even a little.
    const fov = windowCameraFov(photo, 16 / 9);
    const limits = windowLookLimits(photo, { horizontalFov: viewHorizontalFov(fov, 16 / 9), verticalFov: fov }, 0);
    expect(limits.azimuthHalfRange).toBeLessThan(0.01);
    expect(limits.maxElevation).toBeLessThan(0.01);
  });

  it('never lets any corner of the screen leave the photo, anywhere inside the limits', () => {
    const cases: [number, number][] = [
      [50, 9 / 16],
      [50, 1],
      [45, 3 / 4],
      [40, 0.46],
      [windowCameraFov(photo, 9 / 16), 9 / 16], // the zoom the game really uses on a tall phone
      [windowCameraFov(photo, 16 / 9), 16 / 9], // ...and on a wide screen
      [windowCameraFov(photo, 844 / 390), 844 / 390], // ...and on a phone held sideways
    ];
    for (const [verticalFov, aspect] of cases) {
      const view = { horizontalFov: viewHorizontalFov(verticalFov, aspect), verticalFov };
      const limits = windowLookLimits(photo, view, 0);
      for (const yaw of [-1, -0.5, 0, 0.5, 1]) {
        for (const pitch of [-1, -0.5, 0, 0.5, 1]) {
          const ok = windowCornersInside(photo, view, yaw * limits.azimuthHalfRange, pitch * limits.maxElevation);
          expect(ok, `fov ${verticalFov.toFixed(2)}, aspect ${aspect.toFixed(2)}, yaw ${yaw}, pitch ${pitch}`).toBe(true);
        }
      }
    }
  });

  it('is tight: a little further sideways and a corner really does leave the photo', () => {
    const view = { horizontalFov: viewHorizontalFov(50, 9 / 16), verticalFov: 50 };
    const limits = windowLookLimits(photo, view, 0);
    expect(windowCornersInside(photo, view, limits.azimuthHalfRange + 0.3, 0)).toBe(false);
  });
});

describe('windowCameraFov: zoom so the photo covers the screen AND every corner can reach every part of it', () => {
  const photo = { horizontalFov: 73.7398, verticalFov: 53.1301 };

  it('zooms in on a wide screen so the picture is not letterboxed in black (16:9 needs 45.75 degrees)', () => {
    // Half the photo's width is tan = 0.75, so half the screen's height is atan(0.75 / 1.77778) = atan(0.421875) = 22.874 degrees,
    // which is 45.747 degrees tall.
    expect(windowCameraFov(photo, 16 / 9)).toBeCloseTo(45.747, 2);
    // A phone held sideways, 844 x 390 (2.16410:1): atan(0.75 / 2.1641) = atan(0.34657) = 19.1145 degrees, so 38.229 degrees tall.
    expect(windowCameraFov(photo, 844 / 390)).toBeCloseTo(38.229, 2);
  });

  it('zooms in a little on a tall phone too, so the whole width of the photo can be reached without a corner leaving it', () => {
    const fov = windowCameraFov(photo, 9 / 16);
    expect(fov).toBeLessThan(50);
    expect(fov).toBeGreaterThan(40);
    const view = { horizontalFov: viewHorizontalFov(fov, 9 / 16), verticalFov: fov };
    const fullSideways = (photo.horizontalFov - view.horizontalFov) / 2;
    expect(windowCornersInside(photo, view, fullSideways, 0)).toBe(true); // the whole photo is reachable
    const slightlyBigger = { horizontalFov: viewHorizontalFov(fov + 0.5, 9 / 16), verticalFov: fov + 0.5 };
    expect(windowCornersInside(photo, slightlyBigger, (photo.horizontalFov - slightlyBigger.horizontalFov) / 2, 0)).toBe(false); // and not zoomed more than needed
  });

  it('keeps the normal 50 degrees on a 4:3 screen, where nothing is lost', () => {
    // 4:3: half-width tan(25 degrees) x 1.3333 = 0.62175 (63.3 degrees across), so the sideways range is (73.74 - 63.3) / 2 = 5.2 degrees,
    // and the top corner reaches 0.46631 / (cos 5.2 - 0.62175 sin 5.2) = 0.46631 / 0.93951 = 0.4963: inside the 0.5 edge.
    expect(windowCameraFov(photo, 4 / 3)).toBe(50);
  });
});
