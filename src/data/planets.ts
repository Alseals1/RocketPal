import { WORLD_IDS, isWorldId } from './ids';
import { isRealDate, isText } from './text';

export type WorldKind = 'star' | 'planet' | 'moon';

export interface World {
  id: string;
  name: string;
  kind: WorldKind;
  parent?: string;
  diameterKm: number;
  distanceFromSunKm: number;
  distanceFromParentKm?: number;
  orbitDays: number | null;
  moons: { count: number; verify: boolean };
  hook: string;
  color: string;
}

export interface PlanetData {
  lastChecked: string;
  source: string;
  worlds: World[];
}

const KINDS = ['star', 'planet', 'moon'];

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** The checks on the planets file as a whole (not on its worlds). An empty list means the file can be read. */
export function validatePlanetsFile(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return ['planets data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!isText(data.source)) problems.push('source must say where the numbers came from');
  if (!Array.isArray(data.worlds)) problems.push('worlds must be a list');
  return problems;
}

/** The checks on one world by itself. Whether its id is used twice, and whether a moon's parent is there, need the whole list. */
export function validateWorld(raw: unknown): string[] {
  const w = raw as Record<string, any>; // typed loosely: every read allows for a missing field
  const problems: string[] = [];
  const label = isText(w?.id) ? w.id : '(world without an id)';
  if (!isText(w?.id)) problems.push(`${label}: id is required`);
  else if (!isWorldId(w.id)) problems.push(`${label}: not one of the ten worlds`);

  if (!isText(w?.name)) problems.push(`${label}: name is required`);
  if (!KINDS.includes(w?.kind)) problems.push(`${label}: kind must be star, planet, or moon`);
  if (!isPositive(w?.diameterKm)) problems.push(`${label}: diameterKm must be a positive number`);
  if (typeof w?.distanceFromSunKm !== 'number' || w.distanceFromSunKm < 0) {
    problems.push(`${label}: distanceFromSunKm must be 0 or more`);
  }
  if (w?.orbitDays !== null && !isPositive(w?.orbitDays)) {
    problems.push(`${label}: orbitDays must be a positive number, or null for the Sun`);
  }
  if (!Number.isInteger(w?.moons?.count) || w.moons.count < 0 || typeof w.moons.verify !== 'boolean') {
    problems.push(`${label}: moons needs a whole-number count and a verify flag`);
  }
  if (!isText(w?.hook)) problems.push(`${label}: hook is required`);
  if (!/^#[0-9a-fA-F]{6}$/.test(w?.color ?? '')) problems.push(`${label}: color must look like #aabbcc`);
  if (w?.kind === 'moon' && !isPositive(w.distanceFromParentKm)) problems.push(`${w.id}: distanceFromParentKm is required for a moon`);
  return problems;
}

/** Returns a list of problems in the planets data. An empty list means it is valid. */
export function validatePlanets(raw: unknown): string[] {
  const problems = validatePlanetsFile(raw);
  const worlds = (raw as Record<string, unknown> | null)?.worlds;
  if (!Array.isArray(worlds)) return problems;

  const ids = new Set<string>();
  for (const w of worlds as Record<string, any>[]) {
    if (isText(w?.id)) {
      if (ids.has(w.id)) problems.push(`${w.id}: duplicate id`);
      else ids.add(w.id);
    }
    problems.push(...validateWorld(w));
  }

  for (const id of WORLD_IDS) {
    if (!ids.has(id)) problems.push(`${id}: world is missing`);
  }

  for (const w of worlds as Record<string, any>[]) {
    if (w?.kind === 'moon' && !ids.has(w.parent)) problems.push(`${w.id}: parent "${w.parent}" is not a world in the list`);
  }

  return problems;
}
