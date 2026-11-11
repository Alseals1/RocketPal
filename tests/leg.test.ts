import { describe, it, expect } from 'vitest';
import planetsJson from '../public/data/planets.json';
import type { World } from '../src/data/planets';
import { dockDistance, type Vec3 } from '../src/flight/flightModel';
import { layoutWorlds } from '../src/scene/layout';
import { realDistanceRemainingKm } from '../src/scale/readout';
import { planLeg } from '../src/scale/leg';

const layouts = layoutWorlds(planetsJson.worlds as World[]);
const at = (id: string) => layouts.find((l) => l.world.id === id)!;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const offset = (p: Vec3, dx: number, dy = 0, dz = 0): Vec3 => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
/** Between `from` and `to`, `fraction` of the way along the straight line. */
const along = (from: Vec3, to: Vec3, fraction: number): Vec3 => ({
  x: from.x + (to.x - from.x) * fraction,
  y: from.y + (to.y - from.y) * fraction,
  z: from.z + (to.z - from.z) * fraction,
});

/** What the HUD shows for a ship at `ship` heading to `targetId`, planned from `leg`. */
function readout(ship: Vec3, targetId: string): number {
  const target = at(targetId);
  const leg = planLeg(ship, layouts, targetId);
  const remaining = Math.max(0, dist(ship, target.position) - dockDistance(target));
  return realDistanceRemainingKm(leg.legKm, remaining, leg.sceneLeg);
}

describe('planLeg', () => {
  it('starts the leg from the world the ship is nearest to', () => {
    const ship = offset(at('earth').position, 30);
    expect(planLeg(ship, layouts, 'mars').fromId).toBe('earth');
  });

  it('never starts a leg at the destination itself', () => {
    const ship = offset(at('mars').position, 25);
    expect(planLeg(ship, layouts, 'mars').fromId).not.toBe('mars');
  });

  it('knows the real distance of the leg it starts from', () => {
    const ship = offset(at('earth').position, 30);
    expect(planLeg(ship, layouts, 'mars').legKm).toBe(78_400_000); // 228.0 - 149.6 million km, from NASA
  });
});

describe('the real distance the HUD shows', () => {
  it('is about the real Earth-to-Mars distance when leaving Earth for Mars', () => {
    const km = readout(offset(at('earth').position, dockDistance(at('earth'))), 'mars');
    expect(km).toBeGreaterThan(78_400_000 * 0.9);
    expect(km).toBeLessThan(78_400_000 * 1.1);
  });

  it('is about the real Mars-to-Mercury distance when you leave Mars and pick Mercury', () => {
    // Real gap: 228.0 - 57.9 = 170.1 million km. (The old readout showed Sun-to-Mercury, 57.9 million.)
    const km = readout(offset(at('mars').position, dockDistance(at('mars'))), 'mercury');
    expect(km).toBeGreaterThan(170_100_000 * 0.9);
    expect(km).toBeLessThan(170_100_000 * 1.1);
  });

  it('is a billion-km number, not a Sun-to-Earth number, when you pick Earth near Neptune', () => {
    // The old readout clamped this to Sun-to-Earth, 149.6 million km.
    const km = readout(offset(at('neptune').position, dockDistance(at('neptune'))), 'earth');
    expect(km).toBeGreaterThan(4_365_400_000 * 0.9);
    expect(km).toBeLessThan(4_365_400_000 * 1.1);
  });

  it('keeps going down as the ship flies toward the destination, from anywhere', () => {
    const start = at('neptune').position;
    const end = at('earth').position;
    let last = Infinity;
    for (const fraction of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95]) {
      const km = readout(along(start, end, fraction), 'earth');
      expect(km).toBeLessThan(last);
      last = km;
    }
  });

  it('is plausible partway through a trip', () => {
    const km = readout(along(at('earth').position, at('mars').position, 0.5), 'mars');
    expect(km).toBeGreaterThan(78_400_000 * 0.3);
    expect(km).toBeLessThan(78_400_000 * 0.7);
  });

  it('is 0 when docked', () => {
    const mars = at('mars');
    expect(readout(offset(mars.position, dockDistance(mars)), 'mars')).toBeCloseTo(0, 0); // within a kilometre
  });
});
