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
