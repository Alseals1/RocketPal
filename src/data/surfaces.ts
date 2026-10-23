export interface Hotspot {
  id: string;
  /** A few words a screen reader says for the glowing dot. */
  label: string;
  azimuth: number;
  elevation: number;
  title: string;
  text: string;
  /** The NASA pages the fact was checked against (at least one). */
  sources: string[];
  lastChecked: string;
}

export interface Surface {
  worldId: string;
  title: string;
  images: { high: string; low: string };
  credit: string;
  creditNote: string;
  sourceUrl: string;
  start: { azimuth: number; elevation: number };
  orbitHint: string;
  hotspots: Hotspot[];
}

export interface SurfaceData {
  lastChecked: string;
  surfaces: Surface[];
}

/** Short enough for an 8 to 10 year old to read in one go. */
export const LIMITS = { titleChars: 40, textWords: 45, textSentences: 3, hintWords: 20, maxHotspots: 8 };

const isText = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;
const isNumberIn = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const sentences = (text: string) => (text.match(/[.!?]+(\s|$)/g) ?? []).length || (text.trim() ? 1 : 0);

function isRealDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** Returns a list of problems in the surface data. An empty list means it is valid. */
export function validateSurfaces(raw: unknown, worldIds: string[]): string[] {
  if (typeof raw !== 'object' || raw === null) return ['surface data must be an object'];
  const data = raw as Record<string, any>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.surfaces)) return [...problems, 'surfaces must be a list'];

  const seenWorlds = new Set<string>();
  for (const surface of data.surfaces as Record<string, any>[]) {
    const id = isText(surface?.worldId) ? surface.worldId : '(surface without a worldId)';
    if (!worldIds.includes(id)) problems.push(`${id}: not a world in planets.json`);
    if (seenWorlds.has(id)) problems.push(`${id}: listed twice`);
    seenWorlds.add(id);

    if (!isText(surface?.title)) problems.push(`${id}: title is required`);
    if (!isText(surface?.images?.high) || !isText(surface?.images?.low)) problems.push(`${id}: images needs a high and a low file`);
    if (!isText(surface?.credit)) problems.push(`${id}: credit is required (say who took the picture)`);
    if (!isText(surface?.creditNote)) problems.push(`${id}: creditNote is required`);
    if (!/^https:\/\//.test(surface?.sourceUrl ?? '')) problems.push(`${id}: sourceUrl must be an https link`);
    if (!isNumberIn(surface?.start?.azimuth, 0, 360) || surface.start.azimuth === 360 || !isNumberIn(surface?.start?.elevation, -90, 90)) {
      problems.push(`${id}: start needs an azimuth from 0 to under 360 and an elevation from -90 to 90`);
    }
    if (!isText(surface?.orbitHint) || words(surface.orbitHint) > LIMITS.hintWords) {
      problems.push(`${id}: orbitHint is required and must be ${LIMITS.hintWords} words or fewer`);
    }

    const spots = surface?.hotspots;
    if (!Array.isArray(spots) || spots.length < 1 || spots.length > LIMITS.maxHotspots) {
      problems.push(`${id}: hotspots must be a list of 1 to ${LIMITS.maxHotspots}`);
      continue;
    }
    const spotIds = new Set<string>();
    for (const spot of spots as Record<string, any>[]) {
      const label = `${id}/${isText(spot?.id) ? spot.id : '(hotspot without an id)'}`;
      if (!isText(spot?.id)) problems.push(`${label}: id is required`);
      else if (spotIds.has(spot.id)) problems.push(`${label}: duplicate id`);
      else spotIds.add(spot.id);
      if (!isText(spot?.label)) problems.push(`${label}: label is required`);
      if (!isNumberIn(spot?.azimuth, 0, 360) || spot.azimuth === 360) problems.push(`${label}: azimuth must be from 0 to under 360`);
      if (!isNumberIn(spot?.elevation, -90, 90)) problems.push(`${label}: elevation must be from -90 to 90`);
      if (!isText(spot?.title) || spot.title.length > LIMITS.titleChars) problems.push(`${label}: title is required and at most ${LIMITS.titleChars} characters`);
      if (!isText(spot?.text)) problems.push(`${label}: text is required`);
      else {
        if (words(spot.text) > LIMITS.textWords) problems.push(`${label}: text has too many words (at most ${LIMITS.textWords})`);
        if (sentences(spot.text) > LIMITS.textSentences) problems.push(`${label}: text has too many sentences (at most ${LIMITS.textSentences})`);
      }
      if (!Array.isArray(spot?.sources) || spot.sources.length < 1 || !spot.sources.every((u: unknown) => typeof u === 'string' && /^https:\/\//.test(u))) {
        problems.push(`${label}: sources must be a list of one or more https links to the pages the fact was checked against`);
      }
      if (!isRealDate(spot?.lastChecked)) problems.push(`${label}: lastChecked must be a real date`);
    }
  }
  return problems;
}

export async function loadSurfaces(worldIds: string[], url = '/data/surfaces.json'): Promise<SurfaceData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const raw: unknown = await response.json();
  const problems = validateSurfaces(raw, worldIds);
  if (problems.length > 0) throw new Error(`Bad surface data:\n${problems.join('\n')}`);
  return raw as SurfaceData;
}
