import type { Body, ObstacleIndex, Vec3 } from './flightModel';

/**
 * Builds a uniform grid over `bodies`, once per course, so a step only looks at the rocks near the ship.
 * Each body sits in every cell its bounding box touches. The default cell is twice the largest radius,
 * so even the biggest body covers at most two cells along each axis.
 */
export function createObstacleIndex(bodies: readonly Body[], cellSize?: number): ObstacleIndex {
  // A copy, so later edits by the caller cannot put the grid out of step with the bodies.
  const list: readonly Body[] = Object.freeze(bodies.map((b) => ({ position: { ...b.position }, radius: b.radius })));
  let largest = 0;
  for (const body of list) largest = Math.max(largest, body.radius);
  const size = cellSize !== undefined && Number.isFinite(cellSize) && cellSize > 0 ? cellSize : Math.max(2 * largest, 1e-3);

  const cell = (v: number) => Math.floor(v / size);
  const key = (ix: number, iy: number, iz: number) => `${ix},${iy},${iz}`;
  const cells = new Map<string, number[]>();

  list.forEach((body, index) => {
    const { x, y, z } = body.position;
    const r = body.radius;
    for (let ix = cell(x - r); ix <= cell(x + r); ix++) {
      for (let iy = cell(y - r); iy <= cell(y + r); iy++) {
        for (let iz = cell(z - r); iz <= cell(z + r); iz++) {
          const k = key(ix, iy, iz);
          const entry = cells.get(k);
          if (entry) entry.push(index);
          else cells.set(k, [index]);
        }
      }
    }
  });

  const isNear = (p: Vec3, radius: number, index: number) => {
    const b = list[index];
    return Math.hypot(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z) <= radius + b.radius;
  };

  function near(p: Vec3, radius: number): number[] {
    const r = Math.max(0, radius);
    const x0 = cell(p.x - r), x1 = cell(p.x + r);
    const y0 = cell(p.y - r), y1 = cell(p.y + r);
    const z0 = cell(p.z - r), z1 = cell(p.z + r);
    const cellCount = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    // A huge query (or a broken number) would walk more cells than there are bodies: check them all instead.
    if (!(cellCount <= list.length)) {
      const all: number[] = [];
      for (let i = 0; i < list.length; i++) if (isNear(p, r, i)) all.push(i);
      return all;
    }
    const found = new Set<number>();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        for (let iz = z0; iz <= z1; iz++) {
          const entry = cells.get(key(ix, iy, iz));
          if (!entry) continue;
          for (const index of entry) if (!found.has(index) && isNear(p, r, index)) found.add(index);
        }
      }
    }
    return [...found].sort((a, b) => a - b);
  }

  return { bodies: list, near };
}
