import type { PlaceId } from './ids';
import { isRealDate, isText, sentences, words } from './text';

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

/**
 * How a place looks when you arrive (docs/TECHNICAL_ARCHITECTURE.md sections 4.9 and 5.10).
 * "panorama": a 360 degree picture you stand inside (Mars).
 * "window": one ordinary wide photo seen through a window, with a little looking round (Earth from the space station).
 * "flyby": the window view with a cockpit frame and a spacecraft photo (the Moon, Jupiter).
 * "course": the Asteroid Belt Run. In the type only: the validator refuses it until the belt is built.
 */
export type ArrivalKind = 'panorama' | 'window' | 'flyby' | 'course';

/** What the arrival words say: the Sun and the giant planets (and the Moon's fly-by) say "flying past". */
export type ArrivalWording = 'landed' | 'flyingPast';

/**
 * For a window or fly-by view. For a window, the lens the photo was taken with. For a fly-by, a chosen display angle
 * (a planet portrait has no useful lens data): the world fills about two thirds of the window.
 */
export interface WindowPhoto {
  horizontalFov: number;
  verticalFov: number;
  /** The photo's width divided by its height. */
  aspect: number;
}

export interface ArrivalDef {
  place: PlaceId;
  kind: ArrivalKind;
  /** The frame drawn round the photo: "station" for a window, "cockpit" for a fly-by, none for a panorama. */
  frame?: 'station' | 'cockpit';
  wording: ArrivalWording;
  /** Only for window and fly-by views. */
  photo?: WindowPhoto;
  title: string;
  /** What the picture is, for people who cannot see it (read out for the picture). Must be true for this picture. */
  description: string;
  images: { high: string; low: string };
  credit: string;
  creditNote: string;
  sourceUrl: string;
  start: { azimuth: number; elevation: number };
  orbitHint: string;
  hotspots: Hotspot[];
}

/** Window and fly-by views show one flat photo through a frame; they share the same view code and limits. */
export function isWindowLike(def: Pick<ArrivalDef, 'kind'>): boolean {
  return def.kind === 'window' || def.kind === 'flyby';
}

/** surfaces.json as a whole. */
export interface SurfaceData {
  lastChecked: string;
  surfaces: ArrivalDef[];
}

/** Short enough for an 8 to 10 year old to read in one go. */
export const LIMITS = { titleChars: 40, textWords: 45, textSentences: 3, hintWords: 20, maxHotspots: 8 };

const isNumberIn = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

/** The checks on the surfaces file as a whole (not on its pictures). An empty list means the file can be read. */
export function validateSurfacesFile(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return ['surface data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.surfaces)) problems.push('surfaces must be a list');
  return problems;
}

/** Returns a list of problems in the surface data. An empty list means it is valid. */
export function validateSurfaces(raw: unknown, places: readonly string[]): string[] {
  const problems = validateSurfacesFile(raw);
  const surfaces = (raw as Record<string, unknown> | null)?.surfaces;
  if (!Array.isArray(surfaces)) return problems;

  const seenWorlds = new Set<string>();
  for (const surface of surfaces as Record<string, any>[]) {
    const id = isText(surface?.place) ? surface.place : '(surface without a place)';
    if (seenWorlds.has(id)) problems.push(`${id}: listed twice`);
    seenWorlds.add(id);
    problems.push(...validateSurface(surface, places));
  }
  return problems;
}

/**
 * The checks on one arrival picture and its dots. `places` are the places it may belong to. One bad dot makes the
 * whole picture bad: dropping single dots comes with question pools.
 */
export function validateSurface(raw: unknown, places: readonly string[]): string[] {
  // Typed loosely on purpose: every read below allows for a missing field (or a missing picture).
  const surface = raw as Record<string, any>;
  const problems: string[] = [];
  const id = isText(surface?.place) ? surface.place : '(surface without a place)';
  if (!places.includes(id)) problems.push(`${id}: not a world in planets.json`);

  const kind = surface?.kind;
  if (kind === 'course') problems.push(`${id}: kind "course" comes with the asteroid belt and is not ready yet`);
  else if (kind !== 'panorama' && kind !== 'window' && kind !== 'flyby') problems.push(`${id}: kind must be "panorama", "window" or "flyby"`);
  const frameFor: Record<string, string | undefined> = { window: 'station', flyby: 'cockpit', panorama: undefined };
  if (kind in frameFor && surface.frame !== frameFor[kind]) {
    problems.push(frameFor[kind] ? `${id}: a ${kind} view needs frame "${frameFor[kind]}"` : `${id}: a ${kind} view has no frame`);
  }
  if (surface?.wording !== 'landed' && surface?.wording !== 'flyingPast') problems.push(`${id}: wording must be "landed" or "flyingPast"`);
  else if (NO_SOLID_GROUND.has(id) && surface.wording !== 'flyingPast') problems.push(`${id}: has no solid ground, so wording must be "flyingPast"`);
  const windowLike = kind === 'window' || kind === 'flyby';
  if (windowLike) {
    const p = surface.photo;
    const sensible = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 10 && n < 170;
    if (!p || !sensible(p.horizontalFov) || !sensible(p.verticalFov) || !isNumberIn(p.aspect, 0.2, 5)) {
      problems.push(`${id}: photo needs horizontalFov and verticalFov (between 10 and 170 degrees) and an aspect`);
    }
  }
  if (!isText(surface?.title)) problems.push(`${id}: title is required`);
  else if (surface.wording === 'flyingPast' && !surface.title.startsWith('Flying past ')) {
    problems.push(`${id}: a "flyingPast" title starts with "Flying past " (it is never "landed")`);
  }
  if (!isText(surface?.description) || words(surface.description) > 45) {
    problems.push(`${id}: description is required (what the picture is, for people who cannot see it) and at most 45 words`);
  }
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
    return problems;
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
    if (windowLike && surface.photo && isNumberIn(spot?.azimuth, 0, 360) && isNumberIn(spot?.elevation, -90, 90)) {
      // In a window view the photo is the only picture: a dot beside it would float in the black.
      const fromMiddle = ((spot.azimuth + 540) % 360) - 180;
      if (Math.abs(fromMiddle) > surface.photo.horizontalFov / 2 || Math.abs(spot.elevation) > surface.photo.verticalFov / 2) {
        problems.push(`${label}: sits outside the photo`);
      }
    }
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
  return problems;
}

/**
 * Worlds with no solid ground to land on: the Sun and the giant planets (NASA: they have no true surface).
 * GAME_DESIGN.md: the words say "flying past", never "landed", on these. The validator holds `ArrivalDef.wording` to it.
 */
const NO_SOLID_GROUND = new Set(['sun', 'jupiter', 'saturn', 'uranus', 'neptune']);

/** The Sun and the giant planets have no solid ground; every other world does. */
export function hasSolidGround(place: string): boolean {
  return !NO_SOLID_GROUND.has(place);
}

/** The words for a place: its arrival's `wording`, or (for a place with no arrival picture) this fallback. */
export function arrivalWording(place: string, arrival?: Pick<ArrivalDef, 'wording'>): ArrivalWording {
  if (arrival) return arrival.wording;
  return NO_SOLID_GROUND.has(place) ? 'flyingPast' : 'landed';
}
