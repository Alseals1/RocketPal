/**
 * What the Star Map shows (docs/VISUAL_DESIGN.md 7.4): the worlds from the Sun outwards, each with its stars, words for
 * screen readers, a distance line, and where it sits on the track, evenly spaced or by real distance. Pure, so it is
 * unit-tested without a page (tests/starMapModel.test.ts). See decisions/2026-11-21-star-map-and-mission-control.md.
 */
import { WORLD_IDS } from '../data/ids';
import type { World } from '../data/planets';
import { formatDistanceKm, formatDuration, lightTravelSeconds } from '../scale/readout';
import { clampStars, MAX_STARS } from './stars';

/** In real-distance mode the track is this many times longer, so the inner worlds still have room. */
export const REAL_TRACK_FACTOR = 3;

/** The smallest gap between two nodes in real-distance mode, as a share of the track: never less than an even step. */
export function realMinGap(count: number): number {
  return count > 1 ? 1 / (REAL_TRACK_FACTOR * (count - 1)) : 0;
}

export type NodeSize = 'sun' | 'small' | 'large';

export interface StarMapNode {
  id: string;
  name: string;
  /** The world colour token name: `--world-<id>`. */
  color: string;
  size: NodeSize;
  /** 0 to 3. */
  stars: number;
  thumbnail?: string;
  hook: string;
  distanceLine: string;
  isHere: boolean;
  isTarget: boolean;
  /** The next Grand Tour step (#47 sets it; nothing does yet). */
  isNext: boolean;
  /** What a screen reader says: "Jupiter, 7th of 10, 1 star of 3". */
  label: string;
  /** Position on the track from 0 (the Sun) to 1, evenly spaced. */
  even: number;
  /** Position on the track from 0 to 1, by real distance from the Sun, with a minimum gap. */
  real: number;
}

export interface StarMapModel {
  nodes: StarMapNode[];
}

export interface StarMapInput {
  worlds: readonly World[];
  stars: ReadonlyMap<string, number>;
  hereId: string | null;
  targetId: string | null;
  nextId?: string | null;
  thumbnail(id: string): string | undefined;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function nodeLabel(name: string, position: number, count: number, stars: number, isHere: boolean): string {
  const n = clampStars(stars);
  return `${name}, ${ordinal(position)} of ${count}, ${n} ${n === 1 ? 'star' : 'stars'} of ${MAX_STARS}${isHere ? ', you are here' : ''}`;
}

/** Even positions from 0 to 1. */
export function evenSpacing(count: number): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  return Array.from({ length: count }, (_, i) => i / (count - 1));
}

/**
 * Positions from 0 to 1 that follow the real distances, but never closer than `minGap`: the first is 0, the last is 1,
 * and each is at least the one before plus `minGap`. A world far enough out keeps its true share of the way. When the
 * gaps cannot fit (too many worlds for the gap), or the distances are all the same, it gives even spacing.
 */
export function realSpacing(distancesKm: readonly number[], minGap: number): number[] {
  const count = distancesKm.length;
  if (count <= 1) return evenSpacing(count);
  const first = distancesKm[0];
  const span = Math.max(...distancesKm) - first;
  if (span <= 0 || minGap * (count - 1) > 1) return evenSpacing(count);
  const out = distancesKm.map((d) => Math.max(0, (d - first) / span));
  out[0] = 0;
  for (let i = 1; i < count; i++) out[i] = Math.max(out[i], out[i - 1] + minGap); // push outwards
  out[count - 1] = 1;
  for (let i = count - 2; i >= 1; i--) out[i] = Math.min(out[i], out[i + 1] - minGap); // and back in from the far end
  return out;
}

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Which node a key moves to. The arrows stop at the ends (no wrapping); Home and End go to the first and last. */
export function nextNodeIndex(at: number, key: string, count: number): number | undefined {
  if (count <= 0) return undefined;
  if (key in STEPS) return Math.min(count - 1, Math.max(0, at + STEPS[key]));
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return undefined;
}

/** "778.5 million km from the Sun · light takes 43 minutes". The Moon gives its distance from Earth. */
export function distanceLine(world: World, worlds: readonly World[]): string {
  if (world.kind === 'star') return 'The centre of our solar system';
  const parent = world.parent ? worlds.find((w) => w.id === world.parent) : undefined;
  const fromParent = world.kind === 'moon' && world.distanceFromParentKm !== undefined;
  const km = fromParent ? world.distanceFromParentKm! : world.distanceFromSunKm;
  const from = fromParent ? (parent?.name ?? 'its planet') : 'the Sun';
  return `${formatDistanceKm(km)} from ${from} · light takes ${formatDuration(lightTravelSeconds(km))}`;
}

function sizeOf(world: World): NodeSize {
  if (world.kind === 'star') return 'sun';
  return world.diameterKm > 40000 ? 'large' : 'small';
}

const orderOf = (id: string) => {
  const i = (WORLD_IDS as readonly string[]).indexOf(id);
  return i < 0 ? Infinity : i;
};

export function buildStarMapModel({ worlds, stars, hereId, targetId, nextId = null, thumbnail }: StarMapInput): StarMapModel {
  const sorted = [...worlds].sort((a, b) => orderOf(a.id) - orderOf(b.id));
  const count = sorted.length;
  const even = evenSpacing(count);
  const real = realSpacing(
    sorted.map((w) => w.distanceFromSunKm),
    realMinGap(count),
  );
  return {
    nodes: sorted.map((world, i) => {
      const n = clampStars(stars.get(world.id) ?? 0);
      const isHere = world.id === hereId;
      return {
        id: world.id,
        name: world.name,
        color: world.id,
        size: sizeOf(world),
        stars: n,
        thumbnail: thumbnail(world.id),
        hook: world.hook,
        distanceLine: distanceLine(world, sorted),
        isHere,
        isTarget: world.id === targetId,
        isNext: world.id === nextId,
        label: nodeLabel(world.name, i + 1, count, n, isHere),
        even: even[i],
        real: real[i],
      };
    }),
  };
}
