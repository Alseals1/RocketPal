import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLIGHT,
  createShip,
  stepFlight,
  dockDistance,
  type Body,
  type FlightInput,
  type ShipState,
  type Vec3,
} from '../src/flight/flightModel';

const DT = 1 / 60;
const NONE: FlightInput = { turn: 0, pitch: 0, boost: false };
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function fly(
  ship: ShipState,
  seconds: number,
  input: FlightInput | ((t: number) => FlightInput),
  ctx: { target?: Body; obstacles?: Body[] } = {},
): ShipState {
  let s = ship;
  for (let t = 0; t < seconds; t += DT) {
    s = stepFlight(s, typeof input === 'function' ? input(t) : input, DT, ctx);
  }
  return s;
}

const origin: Vec3 = { x: 0, y: 0, z: 0 };

describe('free flight', () => {
  it('flies forward (toward -Z) at cruise speed with no input', () => {
    const s = fly(createShip(origin), 1, NONE);
    expect(s.position.z).toBeCloseTo(-DEFAULT_FLIGHT.cruiseSpeed, 0);
    expect(s.position.x).toBeCloseTo(0, 5);
    expect(s.position.y).toBeCloseTo(0, 5);
  });

  it('steering right ends up on the +X side, and left on the -X side', () => {
    const right = fly(createShip(origin), 2, { ...NONE, turn: 1 });
    const left = fly(createShip(origin), 2, { ...NONE, turn: -1 });
    expect(right.position.x).toBeGreaterThan(5);
    expect(left.position.x).toBeLessThan(-5);
  });

  it('pitching up climbs (+Y) and pitching down dives (-Y)', () => {
    const up = fly(createShip(origin), 1.5, { ...NONE, pitch: 1 });
    const down = fly(createShip(origin), 1.5, { ...NONE, pitch: -1 });
    expect(up.position.y).toBeGreaterThan(5);
    expect(down.position.y).toBeLessThan(-5);
  });

  it('never pitches all the way to straight up or down', () => {
    const s = fly(createShip(origin), 10, { ...NONE, pitch: 1 });
    expect(s.pitch).toBeLessThan(Math.PI / 2);
    expect(s.pitch).toBeGreaterThan(1);
  });

  it('boosts well above cruise speed, but not past the boost limit', () => {
    const s = fly(createShip(origin), 4, { ...NONE, boost: true });
    expect(s.speed).toBeGreaterThan(DEFAULT_FLIGHT.cruiseSpeed * 2);
    expect(s.speed).toBeLessThanOrEqual(DEFAULT_FLIGHT.boostSpeed + 1e-6);
  });

  it('settles back to cruise speed when boost is released', () => {
    const boosted = fly(createShip(origin), 4, { ...NONE, boost: true });
    const settled = fly(boosted, 6, NONE);
    expect(settled.speed).toBeCloseTo(DEFAULT_FLIGHT.cruiseSpeed, 0);
  });

  it('stops turning shortly after the player lets go', () => {
    const turning = fly(createShip(origin), 1, { ...NONE, turn: 1 });
    const letGo = fly(turning, 2, NONE);
    const later = fly(letGo, 0.5, NONE);
    expect(Math.abs(later.yaw - letGo.yaw)).toBeLessThan(0.01);
  });

  it('treats out-of-range input like full input', () => {
    const wild = stepFlight(createShip(origin), { turn: 50, pitch: -50, boost: false }, DT);
    const full = stepFlight(createShip(origin), { turn: 1, pitch: -1, boost: false }, DT);
    expect(wild).toEqual(full);
  });

  it('caps a huge frame hiccup so the ship never teleports', () => {
    const s = stepFlight(createShip(origin), NONE, 5);
    expect(dist(s.position, origin)).toBeLessThanOrEqual(DEFAULT_FLIGHT.cruiseSpeed * 0.1 + 1e-6);
  });
});

describe('obstacles', () => {
  it('never lets the ship fly through a planet, even at full boost', () => {
    const planet: Body = { position: { x: 0, y: 0, z: -300 }, radius: 40 };
    let s = createShip(origin);
    let closest = Infinity;
    for (let t = 0; t < 20; t += DT) {
      s = stepFlight(s, { ...NONE, boost: true }, DT, { obstacles: [planet] });
      closest = Math.min(closest, dist(s.position, planet.position));
    }
    expect(closest).toBeGreaterThanOrEqual(planet.radius - 1e-6);
  });
});

describe('destination assist and docking', () => {
  const earth: Body = { position: { x: 0, y: 0, z: 0 }, radius: 10 };

  // Start poses all around the planet, facing every which way.
  const starts: ShipState[] = [
    createShip({ x: 0, y: 0, z: 600 }, 0, 0), // straight ahead
    createShip({ x: 0, y: 0, z: -600 }, 0, 0), // planet is behind
    createShip({ x: 500, y: 0, z: 0 }, 0, 0), // planet is to the side
    createShip({ x: -400, y: 300, z: 200 }, 2.4, 0.5), // above, looking away
    createShip({ x: 100, y: -500, z: -100 }, -1, -1), // below, looking down
    createShip({ x: 0, y: 700, z: 1 }, 0, 0), // almost straight above
    createShip({ x: 40, y: 0, z: 40 }, 3, 0), // already close, facing away
  ];

  it('turns the nose toward the destination with no player input', () => {
    const start = createShip({ x: 0, y: 0, z: 600 }, Math.PI / 2, 0); // planet is 90 degrees to the right
    const s = fly(start, 1.5, NONE, { target: earth });
    const headingError = Math.abs(Math.atan2(Math.sin(s.yaw - 0), Math.cos(s.yaw - 0)));
    expect(headingError).toBeLessThan(Math.PI / 4);
  });

  it('always docks with no input, from any direction', () => {
    for (const start of starts) {
      const s = fly(start, 300, NONE, { target: earth });
      expect(s.docked).toBe(true);
      expect(dist(s.position, earth.position)).toBeLessThanOrEqual(dockDistance(earth) + 1e-6);
    }
  });

  it('always docks even with boost held down the whole time', () => {
    for (const start of starts) {
      const s = fly(start, 300, { ...NONE, boost: true }, { target: earth });
      expect(s.docked).toBe(true);
    }
  });

  it('always docks once the player lets go, even after steering the wrong way', () => {
    for (const start of starts) {
      const wrongWay = (t: number): FlightInput => (t < 4 ? { turn: -1, pitch: -1, boost: true } : NONE);
      const s = fly(start, 300, wrongWay, { target: earth });
      expect(s.docked).toBe(true);
    }
  });

  it('never touches the surface on the way in', () => {
    for (const start of starts) {
      let s = start;
      let closest = Infinity;
      for (let t = 0; t < 300 && !s.docked; t += DT) {
        s = stepFlight(s, { ...NONE, boost: true }, DT, { target: earth });
        closest = Math.min(closest, dist(s.position, earth.position));
      }
      expect(closest).toBeGreaterThan(earth.radius);
    }
  });

  it('slows right down near the destination, even at full boost', () => {
    let s = createShip({ x: 0, y: 0, z: 800 }, 0, 0);
    let speedNearby = Infinity;
    for (let t = 0; t < 300 && !s.docked; t += DT) {
      s = stepFlight(s, { ...NONE, boost: true }, DT, { target: earth });
      // Only count frames still flying: the final docked frame is stopped by definition.
      if (!s.docked && dist(s.position, earth.position) < dockDistance(earth) * 1.5) {
        speedNearby = Math.min(speedNearby, s.speed);
      }
    }
    expect(speedNearby).toBeLessThan(DEFAULT_FLIGHT.cruiseSpeed / 2); // not Infinity: we did fly through the zone
  });

  it('stays stopped once docked, whatever the player does', () => {
    const docked = fly(createShip({ x: 0, y: 0, z: 300 }, 0, 0), 200, NONE, { target: earth });
    expect(docked.docked).toBe(true);
    const after = fly(docked, 5, { turn: 1, pitch: 1, boost: true }, { target: earth });
    expect(after.position).toEqual(docked.position);
    expect(after.speed).toBe(0);
  });

  it('lets the player steer freely far from the destination', () => {
    const far = createShip({ x: 0, y: 0, z: 5000 }, 0, 0);
    const s = fly(far, 2, { ...NONE, turn: 1 }, { target: earth });
    expect(s.position.x).toBeGreaterThan(5); // the pull did not cancel the player's turn
  });
});

// A small seeded random number generator, so "random" starts are the same on every run.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomStart(rand: () => number, radius: number): ShipState {
  const dir = { x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1 };
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const far = 30 * radius + rand() * 2500; // from fairly close to a long way off
  return createShip(
    { x: (dir.x / len) * far, y: (dir.y / len) * far, z: (dir.z / len) * far },
    (rand() * 2 - 1) * Math.PI,
    (rand() * 2 - 1) * 1.4,
    rand() < 0.5 ? DEFAULT_FLIGHT.cruiseSpeed : DEFAULT_FLIGHT.boostSpeed,
  );
}

describe('docking works for any planet size, speed and frame rate', () => {
  const radii = [0.5, 3, 10, 30, 100];
  const frameTimes = [1 / 60, 1 / 30, 1 / 15, 0.1];

  for (const radius of radii) {
    for (const dt of frameTimes) {
      for (const boost of [false, true]) {
        it(`docks from 40 random starts: radius ${radius}, ${Math.round(1 / dt)} fps, boost ${boost}`, () => {
          const rand = seeded(1000 + radius * 7 + Math.round(1 / dt));
          const body: Body = { position: origin, radius };
          for (let i = 0; i < 40; i++) {
            let s = randomStart(rand, radius);
            let closest = Infinity;
            for (let t = 0; t < 600 && !s.docked; t += dt) {
              s = stepFlight(s, { ...NONE, boost }, dt, { target: body });
              closest = Math.min(closest, dist(s.position, origin));
            }
            expect(s.docked, `start ${i} did not dock`).toBe(true);
            expect(closest).toBeGreaterThan(radius);
          }
        });
      }
    }
  }
});

describe('the last stretch of the approach', () => {
  const earth: Body = { position: origin, radius: 10 };

  it('takes over completely near the planet, even if the player holds the stick the wrong way', () => {
    // Close in, facing away, stick held hard the whole time and never released.
    const start = createShip({ x: 0, y: 0, z: 60 }, Math.PI, 0);
    const s = fly(start, 60, { turn: 1, pitch: -1, boost: true }, { target: earth });
    expect(s.docked).toBe(true);
  });

  it('creeps in quickly enough to arrive in good time', () => {
    const start = createShip({ x: 0, y: 0, z: 400 }, 0, 0);
    let s = start;
    let seconds = 0;
    for (; seconds < 120 && !s.docked; seconds += DT) s = stepFlight(s, NONE, DT, { target: earth });
    expect(s.docked).toBe(true);
    // Cruising in from 400 units takes about 11 s. Without the final creep it drags on past 17 s.
    expect(seconds).toBeLessThan(14);
  });

  it('never touches the surface, whichever way the stick is held', () => {
    const sticks = [-1, 0, 1];
    const rand = seeded(42);
    for (const turn of sticks) {
      for (const pitch of sticks) {
        for (const boost of [false, true]) {
          let s = randomStart(rand, earth.radius);
          // Start inside the area where the planet's pull matters.
          const d = dist(s.position, origin);
          const k = (dockDistance(earth) + 150) / d;
          s = { ...s, position: { x: s.position.x * k, y: s.position.y * k, z: s.position.z * k } };
          let closest = Infinity;
          for (let t = 0; t < 120 && !s.docked; t += DT) {
            s = stepFlight(s, { turn, pitch, boost }, DT, { target: earth });
            closest = Math.min(closest, dist(s.position, origin));
          }
          expect(closest).toBeGreaterThan(earth.radius);
        }
      }
    }
  });
});

describe('obstacles at big frame steps', () => {
  it('does not let a fast ship skip across a small body in one step', () => {
    const pebble: Body = { position: { x: 0, y: 0, z: -50 }, radius: 0.5 };
    let s = createShip(origin, 0, 0, DEFAULT_FLIGHT.boostSpeed);
    for (let t = 0; t < 5; t += 0.1) {
      s = stepFlight(s, { ...NONE, boost: true }, 0.1, { obstacles: [pebble] });
    }
    expect(s.position.z).toBeGreaterThan(pebble.position.z); // never got to the far side
  });
});

describe('levelling out', () => {
  it('eases the nose back to level when the player lets go of pitch and there is no destination', () => {
    const tilted = fly(createShip(origin), 1, { ...NONE, pitch: 1 });
    expect(tilted.pitch).toBeGreaterThan(0.5);
    const later = fly(tilted, 8, NONE);
    expect(Math.abs(later.pitch)).toBeLessThan(0.05);
  });

  it('also levels out from a dive', () => {
    const diving = fly(createShip(origin), 1, { ...NONE, pitch: -1 });
    const later = fly(diving, 8, NONE);
    expect(Math.abs(later.pitch)).toBeLessThan(0.05);
  });

  it('stays tilted for as long as the player holds the stick', () => {
    const held = fly(createShip(origin), 6, { ...NONE, pitch: 1 });
    expect(held.pitch).toBeGreaterThan(1.3);
  });

  it('does not level out slowly enough to feel like a lock: the player can still fly a climb', () => {
    const climbing = fly(createShip(origin), 1, { ...NONE, pitch: 1 });
    const stillClimbing = fly(climbing, 0.3, NONE);
    expect(stillClimbing.pitch).toBeGreaterThan(climbing.pitch * 0.5);
  });

  it('does not fight the pull toward a destination', () => {
    const above: Body = { position: { x: 0, y: 500, z: 0 }, radius: 10 };
    const s = fly(createShip({ x: 0, y: 0, z: 40 }, 0, 0), 300, NONE, { target: above });
    expect(s.docked).toBe(true);
  });
});
