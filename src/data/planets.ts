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

export const WORLD_IDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

const KINDS = ['star', 'planet', 'moon'];

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Returns a list of problems in the planets data. An empty list means it is valid. */
export function validatePlanets(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return ['planets data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];

  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!isText(data.source)) problems.push('source must say where the numbers came from');
  if (!Array.isArray(data.worlds)) return [...problems, 'worlds must be a list'];

  const ids = new Set<string>();
  for (const w of data.worlds as Record<string, any>[]) {
    const label = isText(w?.id) ? w.id : '(world without an id)';
    if (!isText(w?.id)) problems.push(`${label}: id is required`);
    else if (ids.has(w.id)) problems.push(`${label}: duplicate id`);
    else ids.add(w.id);

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
  }

  for (const id of WORLD_IDS) {
    if (!ids.has(id)) problems.push(`${id}: world is missing`);
  }

  for (const w of data.worlds as Record<string, any>[]) {
    if (w?.kind === 'moon') {
      if (!ids.has(w.parent)) problems.push(`${w.id}: parent "${w.parent}" is not a world in the list`);
      if (!isPositive(w.distanceFromParentKm)) problems.push(`${w.id}: distanceFromParentKm is required for a moon`);
    }
  }

  return problems;
}

export async function loadPlanets(url = '/data/planets.json'): Promise<PlanetData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const raw: unknown = await response.json();
  const problems = validatePlanets(raw);
  if (problems.length > 0) throw new Error(`Bad planets data:\n${problems.join('\n')}`);
  return raw as PlanetData;
}
