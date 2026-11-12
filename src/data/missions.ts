import type { Surface, SurfaceData } from './surfaces';
import { isRealDate, isText, words } from './text';

export interface Mission {
  worldId: string;
  /** What Orbit asks the kid to do, for example "Find 3 things on Mars". */
  title: string;
  /** How many of the world's dots must be found to finish the mission. */
  findCount: number;
  /** What Orbit says when the mission is done. */
  done: string;
  /** A friendly cliffhanger about the next world, shown after the quiz. */
  teaser: string;
  teaserWorld: string;
}

export interface MissionData {
  lastChecked: string;
  missions: Mission[];
}

export const MISSION_LIMITS = { titleChars: 40, doneWords: 20, teaserWords: 20 };

/** Returns a list of problems in the mission data. An empty list means it is valid. */
export function validateMissions(raw: unknown, surfaces: SurfaceData, worldIds: readonly string[]): string[] {
  const problems = validateMissionsFile(raw);
  const missions = (raw as Record<string, unknown> | null)?.missions;
  if (!Array.isArray(missions)) return problems;

  const seen = new Set<string>();
  for (const m of missions as Record<string, any>[]) {
    const world = isText(m?.worldId) ? m.worldId : '(mission without a worldId)';
    if (seen.has(world)) problems.push(`${world}: has a mission more than once`);
    seen.add(world);
    problems.push(...validateMission(m, surfaces.surfaces.find((s) => s.worldId === world), worldIds));
  }
  return problems;
}

/** The checks on the missions file as a whole (not on its missions). An empty list means the file can be read. */
export function validateMissionsFile(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['mission data must be an object'];
  const data = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.missions)) problems.push('missions must be a list');
  return problems;
}

/**
 * The checks on one world's mission, against that world's landing picture (`undefined` if it has none).
 * `worldIds` are the worlds its teaser may point at.
 */
export function validateMission(raw: unknown, surface: Surface | undefined, worldIds: readonly string[]): string[] {
  const m = raw as Record<string, any>; // typed loosely: every read allows for a missing field
  const problems: string[] = [];
  const world = isText(m?.worldId) ? m.worldId : '(mission without a worldId)';
  if (!surface) problems.push(`${world}: has a mission but no landing picture`);
  if (!isText(m?.title) || m.title.length > MISSION_LIMITS.titleChars) problems.push(`${world}: title is required and at most ${MISSION_LIMITS.titleChars} characters`);
  if (!Number.isInteger(m?.findCount) || m.findCount < 1 || (surface && m.findCount > surface.hotspots.length)) {
    problems.push(`${world}: findCount must be a whole number from 1 to the number of dots on the picture${surface ? ` (${surface.hotspots.length})` : ''}`);
  }
  if (!isText(m?.done) || words(m.done) > MISSION_LIMITS.doneWords) problems.push(`${world}: done is required and at most ${MISSION_LIMITS.doneWords} words`);
  if (!isText(m?.teaser) || words(m.teaser) > MISSION_LIMITS.teaserWords) problems.push(`${world}: teaser is required and at most ${MISSION_LIMITS.teaserWords} words`);
  if (!isText(m?.teaserWorld) || !worldIds.includes(m.teaserWorld)) problems.push(`${world}: teaserWorld must be a world in planets.json`);
  return problems;
}
