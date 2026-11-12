import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLIGHT,
  createShip,
  dockDistance,
  forwardVector,
  stepFlight,
  stepFlightWithEvents,
  type Body,
  type FlightContext,
  type FlightInput,
  type FlightStep,
  type ShipState,
  type Vec3,
} from '../src/flight/flightModel';
import { createObstacleIndex } from '../src/flight/obstacleIndex';
import { legacyStepFlight } from './fixtures/legacyFlight';

const DT = 1 / 60;
const NONE: FlightInput = { turn: 0, pitch: 0, boost: false };
const FRAME_TIMES = [1 / 60, 1 / 30, 1 / 15, 0.1];
const origin: Vec3 = { x: 0, y: 0, z: 0 };
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const shell = (b: Body) => b.radius * DEFAULT_FLIGHT.obstacleFactor;
const velocity = (s: ShipState): Vec3 => {
  const f = forwardVector(s.yaw, s.pitch);
  return { x: f.x * s.speed, y: f.y * s.speed, z: f.z * s.speed };
};

// The same seeded generator as tests/flightModel.test.ts, so "random" runs are the same every time.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flies with events, returning every step. */
function flySteps(
  ship: ShipState,
  seconds: number,
  input: FlightInput | ((t: number) => FlightInput),
  ctx: FlightContext,
  dt = DT,
): FlightStep[] {
  const steps: FlightStep[] = [];
  let s = ship;
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const step = stepFlightWithEvents(s, typeof input === 'function' ? input(t) : input, dt, ctx);
    steps.push(step);
    s = step.state;
  }
  return steps;
}

/** Rocks with radius 1..8 ahead of the origin (toward -Z), the gap between shells always more than twice the biggest shell. */
function rockField(rand: () => number, count: number, length = 400, width = 40): Body[] {
  const rocks: Body[] = [];
  const gap = 2 * 8 * DEFAULT_FLIGHT.obstacleFactor;
  // One rock sits right in the ship's path, so every field gets bumped into.
  if (count > 0) rocks.push({ position: { x: (rand() * 2 - 1) * 2, y: (rand() * 2 - 1) * 2, z: -25 - rand() * 20 }, radius: 2 + rand() * 6 });
  for (let tries = 0; rocks.length < count && tries < count * 200; tries++) {
    const rock: Body = {
      position: { x: (rand() * 2 - 1) * width, y: (rand() * 2 - 1) * width, z: -20 - rand() * length },
      radius: 1 + rand() * 7,
    };
    if (rocks.every((r) => dist(r.position, rock.position) > shell(r) + shell(rock) + gap)) rocks.push(rock);
  }
  return rocks;
}

describe('stepFlight is unchanged', () => {
  const sticks: FlightInput[] = [NONE, { turn: 1, pitch: 0.5, boost: false }, { turn: -0.4, pitch: -1, boost: true }, { ...NONE, boost: true }];

  for (const dt of FRAME_TIMES) {
    it(`matches the frozen copy of the old stepFlight step for step at ${Math.round(1 / dt)} fps`, () => {
      const rand = seeded(7 + Math.round(1 / dt));
      for (let run = 0; run < 12; run++) {
        const target: Body | undefined = run % 3 === 0 ? undefined : { position: { x: rand() * 200 - 100, y: rand() * 200 - 100, z: -300 - rand() * 300 }, radius: 3 + rand() * 20 };
        const obstacles: Body[] | undefined = run % 2 === 0 ? rockField(rand, 25, 300, 15) : undefined;
        const ctx = { target, obstacles };
        let s = createShip(origin, rand() * 0.4 - 0.2, rand() * 0.4 - 0.2, rand() < 0.5 ? 40 : 160);
        let legacy = s;
        for (let t = 0; t < 12 && !s.docked; t += dt) {
          const input = sticks[Math.floor(t / 1.5) % sticks.length];
          const step = stepFlightWithEvents(s, input, dt, ctx);
          legacy = legacyStepFlight(legacy, input, dt, ctx);
          expect(step.state).toEqual(legacy);
          expect(stepFlight(s, input, dt, ctx)).toEqual(step.state);
          expect(Array.isArray(step.contacts)).toBe(true);
          expect(Array.isArray(step.passed)).toBe(true);
          s = step.state;
        }
      }
    });
  }

  it('returns a docked ship as it is, with no events', () => {
    const earth: Body = { position: origin, radius: 10 };
    let s = createShip({ x: 0, y: 0, z: 200 });
    for (let t = 0; t < 120 && !s.docked; t += DT) s = stepFlight(s, NONE, DT, { target: earth });
    expect(s.docked).toBe(true);
    const step = stepFlightWithEvents(s, { turn: 1, pitch: 1, boost: true }, DT, { target: earth, obstacles: [earth] });
    expect(step.state).toBe(s);
    expect(step.contacts).toEqual([]);
    expect(step.passed).toEqual([]);
  });

  it('still docks with checkpoints and an index in the context', () => {
    const earth: Body = { position: origin, radius: 10 };
    const ctx: FlightContext = {
      target: earth,
      obstacles: createObstacleIndex([{ position: { x: 300, y: 0, z: 0 }, radius: 5 }]),
      checkpoints: [{ position: { x: 0, y: 0, z: 100 }, radius: 4 }],
    };
    const steps = flySteps(createShip({ x: 0, y: 0, z: 400 }), 120, { ...NONE, boost: true }, ctx);
    expect(steps.some((step) => step.state.docked)).toBe(true);
    expect(dist(steps.find((step) => step.state.docked)!.state.position, origin)).toBeLessThanOrEqual(dockDistance(earth) + 1e-6);
  });
});

describe('contacts', () => {
  const rock: Body = { position: { x: 0, y: 0, z: -50 }, radius: 5 };

  it('reports the rock the ship flies into, with a unit normal pointing at the ship', () => {
    const steps = flySteps(createShip(origin), 3, NONE, { obstacles: [rock] });
    const first = steps.find((s) => s.contacts.length > 0)!;
    expect(first.contacts).toHaveLength(1);
    const { body, normal } = first.contacts[0];
    expect(body).toBe(0);
    expect(len(normal)).toBeCloseTo(1, 9);
    const toShip = { x: first.state.position.x - rock.position.x, y: first.state.position.y - rock.position.y, z: first.state.position.z - rock.position.z };
    expect(dot(normal, toShip)).toBeGreaterThan(0);
    expect(normal.z).toBeCloseTo(1, 6);
  });

  it('keeps reporting the rock while the ship slides against it (no bounce)', () => {
    const steps = flySteps(createShip(origin), 3, NONE, { obstacles: [rock] });
    const firstIndex = steps.findIndex((s) => s.contacts.length > 0);
    for (const step of steps.slice(firstIndex, firstIndex + 10)) {
      expect(step.contacts.map((c) => c.body)).toEqual([0]);
    }
  });

  it('reports two rocks touched in one step, in the order the ship met them', () => {
    // The near rock is second in the list, so the order shows it is "first touched", not list order.
    const near: Body = { position: { x: 0.5, y: 0, z: -5 }, radius: 1 };
    const far: Body = { position: { x: -1.5, y: 0, z: -11 }, radius: 1 };
    const step = stepFlightWithEvents(createShip(origin, 0, 0, 160), { ...NONE, boost: true }, 0.1, { obstacles: [far, near] });
    expect(step.contacts.map((c) => c.body)).toEqual([1, 0]);
  });

  it('never reports the same rock twice in one step', () => {
    const rand = seeded(99);
    const rocks = rockField(rand, 60, 300, 10);
    for (const dt of FRAME_TIMES) {
      for (const bounce of [undefined, { restitution: 0.6, speedAfter: 20 }]) {
        for (const step of flySteps(createShip(origin, 0, 0, 160), 4, { turn: 0.3, pitch: 0.2, boost: true }, { obstacles: rocks, bounce }, dt)) {
          const ids = step.contacts.map((c) => c.body);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }
    }
  });
});

describe('bounce', () => {
  const rock: Body = { position: { x: 0, y: 0, z: -30 }, radius: 5 };

  it('turns a head-on hit straight around, caps the speed and stops the turning', () => {
    const steps = flySteps(createShip(origin), 2, NONE, { obstacles: [rock], bounce: { restitution: 1, speedAfter: 10 } });
    const hit = steps.find((s) => s.contacts.length > 0)!;
    expect(Math.abs(Math.abs(hit.state.yaw) - Math.PI)).toBeLessThan(1e-9);
    expect(hit.state.pitch).toBeCloseTo(0, 9);
    expect(hit.state.speed).toBeLessThanOrEqual(10);
    expect(hit.state.yawRate).toBe(0);
    expect(hit.state.pitchRate).toBe(0);
  });

  it('bumps only once on a head-on hit, then flies away from the rock', () => {
    const steps = flySteps(createShip(origin), 3, NONE, { obstacles: [rock], bounce: { restitution: 0.5, speedAfter: 15 } });
    expect(steps.filter((s) => s.contacts.length > 0)).toHaveLength(1);
    const last = steps[steps.length - 1].state;
    const away = { x: last.position.x - rock.position.x, y: last.position.y - rock.position.y, z: last.position.z - rock.position.z };
    expect(dot(velocity(last), away)).toBeGreaterThan(0);
    expect(dist(last.position, rock.position)).toBeGreaterThan(shell(rock) + 10);
  });

  it('keeps the sliding part of a glancing hit and flips the part into the rock', () => {
    const offRock: Body = { position: { x: 2, y: 0, z: -30 }, radius: 5 };
    const steps = flySteps(createShip(origin), 2, NONE, { obstacles: [offRock], bounce: { restitution: 1, speedAfter: 1000 } });
    const hit = steps.find((s) => s.contacts.length > 0)!;
    const n = hit.contacts[0].normal;
    const before = { x: 0, y: 0, z: -DEFAULT_FLIGHT.cruiseSpeed };
    const after = velocity(hit.state);
    expect(dot(before, n)).toBeLessThan(0);
    expect(dot(after, n)).toBeCloseTo(-dot(before, n), 6);
    const tangent = (v: Vec3) => ({ x: v.x - dot(v, n) * n.x, y: v.y - dot(v, n) * n.y, z: v.z - dot(v, n) * n.z });
    expect(dist(tangent(after), tangent(before))).toBeLessThan(1e-6);
    expect(hit.state.speed).toBeCloseTo(DEFAULT_FLIGHT.cruiseSpeed, 9);
  });

  it('treats restitution outside 0..1 as the nearest end', () => {
    const offRock: Body = { position: { x: 2, y: 0, z: -30 }, radius: 5 };
    const run = (restitution: number) => flySteps(createShip(origin), 2, NONE, { obstacles: [offRock], bounce: { restitution, speedAfter: 25 } });
    expect(run(5)).toEqual(run(1));
    expect(run(-3)).toEqual(run(0));
    expect(run(1)).not.toEqual(run(0));
  });

  it('never speeds the ship up', () => {
    const steps = flySteps(createShip(origin), 2, NONE, { obstacles: [rock], bounce: { restitution: 1, speedAfter: 1000 } });
    const hit = steps.find((s) => s.contacts.length > 0)!;
    expect(hit.state.speed).toBeLessThanOrEqual(DEFAULT_FLIGHT.cruiseSpeed + 1e-9);
  });

  it('never ends the run: after a full stop the ship picks up speed again', () => {
    const steps = flySteps(createShip(origin), 5, NONE, { obstacles: [rock], bounce: { restitution: 0, speedAfter: 0 } });
    const hit = steps.find((s) => s.contacts.length > 0)!;
    expect(hit.state.speed).toBe(0);
    const last = steps[steps.length - 1].state;
    expect(last.docked).toBe(false);
    expect(last.speed).toBeGreaterThan(DEFAULT_FLIGHT.cruiseSpeed * 0.9);
    expect(dist(last.position, rock.position)).toBeGreaterThan(shell(rock) + 20);
  });

  it('slides along the rock as before when there is no bounce', () => {
    const steps = flySteps(createShip(origin), 2, NONE, { obstacles: [rock] });
    const hit = steps.find((s) => s.contacts.length > 0)!;
    expect(hit.state.yaw).toBe(0);
    expect(hit.state.speed).toBeCloseTo(DEFAULT_FLIGHT.cruiseSpeed, 9);
  });
});

describe('a bump always ends outside the body', () => {
  const sticks = [-1, 0, 1];
  for (const dt of FRAME_TIMES) {
    it(`at ${Math.round(1 / dt)} fps, with and without boost, bounce and an index`, () => {
      let contacts = 0;
      for (const boost of [false, true]) {
        for (const bounce of [undefined, { restitution: 0.7, speedAfter: 25 }]) {
          for (const turn of sticks) {
            for (const pitch of sticks) {
              const rand = seeded(500 + Math.round(1 / dt) * 13 + turn * 3 + pitch);
              const rocks = rockField(rand, 40, 250, 12);
              for (const obstacles of [rocks, createObstacleIndex(rocks)]) {
                // Turn only now and then, so the ship flies into rocks instead of circling.
                const input = (t: number): FlightInput => ({ turn: t % 2 < 0.5 ? turn : 0, pitch: t % 3 < 0.5 ? pitch : 0, boost });
                for (const step of flySteps(createShip(origin, 0, 0, boost ? 160 : 40), 4, input, { obstacles, bounce }, dt)) {
                  contacts += step.contacts.length;
                  for (const r of rocks) expect(dist(step.state.position, r.position)).toBeGreaterThan(r.radius);
                }
              }
            }
          }
        }
      }
      expect(contacts).toBeGreaterThan(0); // the runs really did hit rocks
    });
  }
});

describe('checkpoints', () => {
  const countPasses = (steps: FlightStep[], index = 0) => steps.filter((s) => s.passed.includes(index)).length;

  for (const dt of FRAME_TIMES) {
    it(`reports a checkpoint flown straight through exactly once at ${Math.round(1 / dt)} fps`, () => {
      const ring: Body = { position: { x: 0, y: 0, z: -100 }, radius: 3 };
      expect(countPasses(flySteps(createShip(origin), 6, NONE, { checkpoints: [ring] }, dt))).toBe(1);
    });
  }

  it('catches a tiny checkpoint that a fast ship crosses between two frames', () => {
    const pin: Body = { position: { x: 0, y: 0, z: -40.5 }, radius: 0.5 };
    const steps = flySteps(createShip(origin, 0, 0, 160), 1, { ...NONE, boost: true }, { checkpoints: [pin] }, 0.1);
    expect(countPasses(steps)).toBe(1);
    expect(steps.every((s) => dist(s.state.position, pin.position) > pin.radius)).toBe(true); // no frame ended inside it
  });

  it('reports a big checkpoint once, however long the ship stays inside', () => {
    const big: Body = { position: { x: 0, y: 0, z: -80 }, radius: 60 };
    const steps = flySteps(createShip(origin), 5, NONE, { checkpoints: [big] });
    expect(steps.filter((s) => dist(s.state.position, big.position) <= big.radius).length).toBeGreaterThan(100);
    expect(countPasses(steps)).toBe(1);
  });

  it('never reports a checkpoint the ship starts inside', () => {
    const around: Body = { position: origin, radius: 30 };
    expect(countPasses(flySteps(createShip(origin), 0.5, NONE, { checkpoints: [around] }))).toBe(0);
  });

  it('never reports a checkpoint the path misses', () => {
    const aside: Body = { position: { x: 3.2, y: 0, z: -100 }, radius: 3 };
    for (const dt of FRAME_TIMES) {
      expect(countPasses(flySteps(createShip(origin), 6, NONE, { checkpoints: [aside] }, dt))).toBe(0);
    }
  });

  it('lists every checkpoint entered in one step, ascending and without repeats', () => {
    const checkpoints: Body[] = [
      { position: { x: 0, y: 0, z: -12 }, radius: 1 },
      { position: { x: 0, y: 0, z: -4 }, radius: 1 },
      { position: { x: 50, y: 0, z: -8 }, radius: 1 },
      { position: { x: 0, y: 0, z: -8 }, radius: 1 },
    ];
    const step = stepFlightWithEvents(createShip(origin, 0, 0, 160), { ...NONE, boost: true }, 0.1, { checkpoints });
    expect(step.passed).toEqual([0, 1, 3]);
  });

  it('never moves or blocks the ship', () => {
    const rand = seeded(3);
    const checkpoints = rockField(rand, 30, 200, 5);
    const input = { turn: 0.3, pitch: -0.2, boost: true };
    let a = createShip(origin);
    let b = a;
    for (let t = 0; t < 4; t += DT) {
      a = stepFlightWithEvents(a, input, DT, { checkpoints }).state;
      b = stepFlight(b, input, DT);
      expect(a).toEqual(b);
    }
  });
});

describe('the same events at any frame rate', () => {
  it('passes the same checkpoints and first hits the same rock at the same point on straight flights', () => {
    const rand = seeded(2024);
    let hits = 0;
    for (let ray = 0; ray < 25; ray++) {
      const yaw = (rand() * 2 - 1) * Math.PI;
      const ahead = forwardVector(yaw, 0);
      const side = { x: -ahead.z, y: 0, z: ahead.x };
      // Bodies scattered around the ship's straight path.
      const around = (count: number, maxRadius: number): Body[] =>
        Array.from({ length: count }, () => {
          const along = 20 + rand() * 300;
          const off = (rand() * 2 - 1) * 12;
          const up = (rand() * 2 - 1) * 12;
          return {
            position: { x: ahead.x * along + side.x * off, y: up, z: ahead.z * along + side.z * off },
            radius: 0.5 + rand() * maxRadius,
          };
        });
      const checkpoints = around(20, 4);
      const rocks: Body[] = []; // kept apart from each other below
      for (const candidate of around(40, 6)) {
        if (rocks.every((r) => dist(r.position, candidate.position) > shell(r) + shell(candidate))) rocks.push(candidate);
      }

      const results = FRAME_TIMES.map((dt) => {
        // Checkpoints alone: the path stays straight the whole way.
        const passed = new Set<number>();
        for (const step of flySteps(createShip(origin, yaw, 0), 9, NONE, { checkpoints }, dt)) step.passed.forEach((i) => passed.add(i));
        // Rocks with bounce: find the first bump.
        const first = flySteps(createShip(origin, yaw, 0), 9, NONE, { obstacles: rocks, bounce: { restitution: 0.5, speedAfter: 10 } }, dt).find(
          (s) => s.contacts.length > 0,
        )?.contacts[0];
        return { passed: [...passed].sort((a, b) => a - b), first };
      });

      for (const r of results) expect(r.passed).toEqual(results[0].passed);
      const first = results[0].first;
      for (const r of results) expect(r.first?.body).toBe(first?.body);
      if (first) {
        hits++;
        const rock = rocks[first.body];
        const point = (n: Vec3) => ({ x: rock.position.x + n.x * shell(rock), y: rock.position.y + n.y * shell(rock), z: rock.position.z + n.z * shell(rock) });
        for (const r of results) expect(dist(point(r.first!.normal), point(first.normal))).toBeLessThan(0.01 * rock.radius);
      }
    }
    expect(hits).toBeGreaterThan(5); // the rays really did hit rocks
  });
});

describe('with an ObstacleIndex', () => {
  it('never lets the ship fly through a planet, even at full boost', () => {
    const planet: Body = { position: { x: 0, y: 0, z: -300 }, radius: 40 };
    const index = createObstacleIndex([planet]);
    let s = createShip(origin);
    let closest = Infinity;
    for (let t = 0; t < 20; t += DT) {
      s = stepFlight(s, { ...NONE, boost: true }, DT, { obstacles: index });
      closest = Math.min(closest, dist(s.position, planet.position));
    }
    expect(closest).toBeGreaterThanOrEqual(planet.radius - 1e-6);
  });

  it('does not let a fast ship skip across a small body in one step', () => {
    const pebble: Body = { position: { x: 0, y: 0, z: -50 }, radius: 0.5 };
    const index = createObstacleIndex([pebble]);
    let s = createShip(origin, 0, 0, DEFAULT_FLIGHT.boostSpeed);
    for (let t = 0; t < 5; t += 0.1) s = stepFlight(s, { ...NONE, boost: true }, 0.1, { obstacles: index });
    expect(s.position.z).toBeGreaterThan(pebble.position.z);
  });

  it('reports contacts with indexes into index.bodies, the same as the plain list', () => {
    const rand = seeded(77);
    const rocks = rockField(rand, 50, 300, 10);
    const index = createObstacleIndex(rocks);
    const input = { turn: 0.2, pitch: -0.1, boost: true };
    const bounce = { restitution: 0.6, speedAfter: 20 };
    const withList = flySteps(createShip(origin), 4, input, { obstacles: rocks, bounce });
    const withIndex = flySteps(createShip(origin), 4, input, { obstacles: index, bounce });
    const bumps = (steps: FlightStep[]) => steps.flatMap((s) => s.contacts.map((c) => c.body));
    expect(bumps(withList).length).toBeGreaterThan(0);
    // Sub-steps are sized from nearby rocks only, so positions can differ by rounding, but not which rocks get hit.
    expect(bumps(withIndex)).toEqual(bumps(withList));
    for (const c of withIndex.flatMap((s) => s.contacts)) expect(index.bodies[c.body]).toEqual(rocks[c.body]);
  });

  it('uses one step and no collision checks when nothing is near', () => {
    const far: Body = { position: { x: 0, y: 0, z: -5000 }, radius: 1 };
    const index = createObstacleIndex([far]);
    const ship = createShip(origin, 0.3, 0.1, 160);
    expect(stepFlight(ship, NONE, 0.1, { obstacles: index })).toEqual(stepFlight(ship, NONE, 0.1));
  });
});
