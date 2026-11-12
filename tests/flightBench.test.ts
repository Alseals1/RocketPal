import { describe, it, expect } from 'vitest';
import { createShip, stepFlightWithEvents, type Body, type FlightContext, type FlightInput } from '../src/flight/flightModel';
import { createObstacleIndex } from '../src/flight/obstacleIndex';

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The 1 ms limit is generous on purpose (a step costs tens of microseconds), so a slow CI machine
// does not make this flaky. If it ever does fail there, raise the limit; do not skip the test.
const LIMIT_MS = 1;

describe('a 200-rock course stays cheap to fly', () => {
  for (const dt of [1 / 60, 0.1]) {
    it(`a step averages under ${LIMIT_MS} ms with 200 rocks, bounce and boost at ${Math.round(1 / dt)} fps`, () => {
      const rand = seeded(200);
      // A 2,000-long tube of rocks along -Z, so the ship keeps meeting new ones.
      const rocks: Body[] = Array.from({ length: 200 }, () => ({
        position: { x: (rand() * 2 - 1) * 8, y: (rand() * 2 - 1) * 8, z: -rand() * 2000 },
        radius: 1 + rand() * 7,
      }));
      const ctx: FlightContext = {
        obstacles: createObstacleIndex(rocks),
        bounce: { restitution: 0.6, speedAfter: 20 },
        checkpoints: Array.from({ length: 30 }, () => ({ position: { x: (rand() * 2 - 1) * 20, y: (rand() * 2 - 1) * 20, z: -rand() * 2000 }, radius: 3 })),
      };
      const input = (i: number): FlightInput => ({ turn: Math.sin(i / 40) * 0.1, pitch: Math.cos(i / 55) * 0.1, boost: true });

      let ship = createShip({ x: 0, y: 0, z: 0 }, 0, 0, 160);
      for (let i = 0; i < 200; i++) ship = stepFlightWithEvents(ship, input(i), dt, ctx).state; // warm up

      let contacts = 0;
      const steps = 2000;
      const started = performance.now();
      for (let i = 0; i < steps; i++) {
        const step = stepFlightWithEvents(ship, input(i), dt, ctx);
        contacts += step.contacts.length;
        // Keep the ship in the tube: once a bounce throws it out (or it reaches the end), put it back on the
        // middle line, facing down the tube, and fly on.
        const p = step.state.position;
        const z = p.z < -2000 || p.z > 0 ? 0 : p.z;
        ship = Math.abs(p.x) > 12 || Math.abs(p.y) > 12 || z !== p.z ? { ...step.state, position: { x: 0, y: 0, z }, yaw: 0, pitch: 0 } : step.state;
      }
      const meanMs = (performance.now() - started) / steps;
      console.info(`flight step with 200 rocks at ${Math.round(1 / dt)} fps: ${(meanMs * 1000).toFixed(1)} µs per step, ${contacts} contacts`);
      expect(contacts).toBeGreaterThan(0); // the timed steps include bumps and bounces
      expect(meanMs).toBeLessThan(LIMIT_MS);
    });
  }
});
