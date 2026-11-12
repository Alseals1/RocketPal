import { describe, it, expect } from 'vitest';
import type { Body, Vec3 } from '../src/flight/flightModel';
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

const bruteForce = (bodies: readonly Body[], p: Vec3, r: number) =>
  bodies.flatMap((b, i) => (Math.hypot(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z) <= r + b.radius ? [i] : []));

function field(rand: () => number, count: number, span: number, minRadius: number, maxRadius: number): Body[] {
  return Array.from({ length: count }, () => ({
    position: { x: (rand() * 2 - 1) * span, y: (rand() * 2 - 1) * span, z: (rand() * 2 - 1) * span },
    radius: minRadius + rand() * (maxRadius - minRadius),
  }));
}

describe('createObstacleIndex', () => {
  const cases = [
    { name: 'no bodies', count: 0, minR: 1, maxR: 8 },
    { name: 'one body', count: 1, minR: 1, maxR: 8 },
    { name: '200 rocks', count: 200, minR: 1, maxR: 8 },
    { name: 'mixed sizes', count: 120, minR: 0.05, maxR: 60 },
  ];

  for (const c of cases) {
    for (const cellSize of [undefined, 3, 50]) {
      it(`finds exactly what brute force finds: ${c.name}, cell size ${cellSize ?? 'default'}`, () => {
        const rand = seeded(c.count * 31 + (cellSize ?? 0));
        const bodies = field(rand, c.count, 200, c.minR, c.maxR);
        const index = createObstacleIndex(bodies, cellSize);
        for (let q = 0; q < 400; q++) {
          // Mostly inside the field, some on the edge, some far outside it.
          const reach = q % 10 === 0 ? 2000 : q % 10 === 1 ? 260 : 200;
          const p = { x: (rand() * 2 - 1) * reach, y: (rand() * 2 - 1) * reach, z: (rand() * 2 - 1) * reach };
          const r = q % 7 === 0 ? 0 : rand() * 40;
          const found = index.near(p, r);
          expect(found).toEqual(bruteForce(bodies, p, r));
        }
      });
    }
  }

  it('finds a body whose surface the query point sits on, at r = 0', () => {
    const bodies: Body[] = [{ position: { x: 10, y: 0, z: 0 }, radius: 4 }];
    const index = createObstacleIndex(bodies);
    expect(index.near({ x: 6, y: 0, z: 0 }, 0)).toEqual([0]);
    expect(index.near({ x: 5.9, y: 0, z: 0 }, 0)).toEqual([]);
  });

  it('answers ascending and without repeats, even when big bodies span many cells', () => {
    const rand = seeded(5);
    const bodies = field(rand, 80, 100, 10, 40);
    const index = createObstacleIndex(bodies, 2);
    for (let q = 0; q < 50; q++) {
      const found = index.near({ x: rand() * 100, y: rand() * 100, z: rand() * 100 }, 30);
      expect(found).toEqual([...new Set(found)].sort((a, b) => a - b));
    }
  });

  it('copes with a huge query radius and with bad numbers', () => {
    const bodies = field(seeded(9), 30, 100, 1, 5);
    const index = createObstacleIndex(bodies);
    expect(index.near({ x: 0, y: 0, z: 0 }, 1e9)).toEqual(bodies.map((_, i) => i));
    expect(index.near({ x: Number.NaN, y: 0, z: 0 }, 5)).toEqual([]);
    expect(index.near({ x: 0, y: 0, z: 0 }, -5)).toEqual(bruteForce(bodies, { x: 0, y: 0, z: 0 }, 0));
  });

  it('keeps its own copy of the bodies', () => {
    const bodies: Body[] = [{ position: { x: 0, y: 0, z: -20 }, radius: 3 }];
    const index = createObstacleIndex(bodies);
    expect(index.bodies).toEqual(bodies);
    bodies[0].position.z = 500;
    bodies.push({ position: { x: 0, y: 0, z: 0 }, radius: 1 });
    expect(index.bodies).toEqual([{ position: { x: 0, y: 0, z: -20 }, radius: 3 }]);
    expect(index.near({ x: 0, y: 0, z: -20 }, 0)).toEqual([0]);
    expect(Object.isFrozen(index.bodies)).toBe(true);
  });

  it('ignores a cell size that is not a positive number', () => {
    const bodies = field(seeded(11), 50, 100, 1, 8);
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const index = createObstacleIndex(bodies, bad);
      const p = { x: 10, y: -5, z: 20 };
      expect(index.near(p, 15)).toEqual(bruteForce(bodies, p, 15));
    }
  });
});
