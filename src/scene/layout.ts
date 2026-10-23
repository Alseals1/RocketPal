import type { World } from '../data/planets';
import type { Vec3 } from '../flight/flightModel';

export interface BodyLayout {
  world: World;
  position: Vec3;
  radius: number;
}

/** Scene units from the Sun to Earth. Other orbits scale with the square root of the real distance. */
const EARTH_ORBIT = 1200;
const EARTH_SUN_KM = 149_600_000;
const EARTH_DIAMETER_KM = 12_756;
const SUN_RADIUS = 90;
/** Planets are spread around the Sun at these steps so they do not all line up. */
const FIRST_ANGLE = 0.4;
const ANGLE_STEP = 0.9;
const MOON_DISTANCE = 60;

export function sceneOrbitRadius(distanceFromSunKm: number): number {
  return EARTH_ORBIT * Math.sqrt(distanceFromSunKm / EARTH_SUN_KM);
}

/** Small worlds stay easy to see: size grows with the 0.45 power of the real diameter. */
export function sceneBodyRadius(world: World): number {
  if (world.kind === 'star') return SUN_RADIUS;
  return 8 * Math.pow(world.diameterKm / EARTH_DIAMETER_KM, 0.45);
}

export function layoutWorlds(worlds: World[]): BodyLayout[] {
  const layouts = new Map<string, BodyLayout>();
  let planetIndex = 0;

  for (const world of worlds) {
    if (world.kind === 'moon') continue;
    let position: Vec3 = { x: 0, y: 0, z: 0 };
    if (world.kind === 'planet') {
      const angle = FIRST_ANGLE + ANGLE_STEP * planetIndex++;
      const orbit = sceneOrbitRadius(world.distanceFromSunKm);
      position = { x: orbit * Math.cos(angle), y: 0, z: orbit * Math.sin(angle) };
    }
    layouts.set(world.id, { world, position, radius: sceneBodyRadius(world) });
  }

  for (const world of worlds) {
    if (world.kind !== 'moon') continue;
    const parent = layouts.get(world.parent ?? '');
    if (!parent) throw new Error(`${world.id}: parent ${world.parent} has no layout`);
    const angle = Math.atan2(parent.position.z, parent.position.x) + 1.2;
    layouts.set(world.id, {
      world,
      position: {
        x: parent.position.x + MOON_DISTANCE * Math.cos(angle),
        y: 6,
        z: parent.position.z + MOON_DISTANCE * Math.sin(angle),
      },
      radius: sceneBodyRadius(world),
    });
  }

  // Keep the order of the data file (journey order).
  return worlds.map((w) => layouts.get(w.id)!);
}
