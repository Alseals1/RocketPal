import { dockDistance, type Vec3 } from '../flight/flightModel';
import type { BodyLayout } from '../scene/layout';
import { distanceBetweenKm } from './readout';

/**
 * The trip the HUD measures. The scene is shrunk, so the HUD needs to know how many real km
 * one scene unit stands for on this trip: `legKm` real km over `sceneLeg` scene units.
 */
export interface Leg {
  /** The world the trip is measured from: the one nearest the ship when the destination was picked. */
  fromId: string;
  legKm: number;
  sceneLeg: number;
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Works out the leg for a ship at `shipPosition` heading to `targetId`. The trip starts at the
 * world nearest the ship (never the destination itself), so it is right even when the ship is
 * in the middle of space or has just changed its mind about where to go.
 */
export function planLeg(shipPosition: Vec3, layouts: BodyLayout[], targetId: string): Leg {
  const target = layouts.find((l) => l.world.id === targetId);
  if (!target) throw new Error(`Unknown destination: ${targetId}`);

  let from = layouts.find((l) => l.world.id !== targetId)!;
  let nearest = Infinity;
  for (const layout of layouts) {
    if (layout.world.id === targetId) continue;
    const gap = distance(shipPosition, layout.position) - layout.radius;
    if (gap < nearest) {
      nearest = gap;
      from = layout;
    }
  }

  return {
    fromId: from.world.id,
    legKm: distanceBetweenKm(from.world, target.world),
    sceneLeg: Math.max(1, distance(from.position, target.position) - dockDistance(target)),
  };
}
