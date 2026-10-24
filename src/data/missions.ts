import type { SurfaceData } from './surfaces';
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
export function validateMissions(raw: unknown, surfaces: SurfaceData, worldIds: string[]): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['mission data must be an object'];
  const data = raw as Record<string, any>;
  const problems: string[] = [];
  if (!isRealDate(data.lastChecked)) problems.push('lastChecked must be a real date like 2026-10-23');
  if (!Array.isArray(data.missions)) return [...problems, 'missions must be a list'];

  const seen = new Set<string>();
  for (const m of data.missions as Record<string, any>[]) {
    const world = isText(m?.worldId) ? m.worldId : '(mission without a worldId)';
    const surface = surfaces.surfaces.find((s) => s.worldId === world);
    if (!surface) problems.push(`${world}: has a mission but no landing picture`);
    if (seen.has(world)) problems.push(`${world}: has a mission more than once`);
    seen.add(world);

    if (!isText(m?.title) || m.title.length > MISSION_LIMITS.titleChars) problems.push(`${world}: title is required and at most ${MISSION_LIMITS.titleChars} characters`);
    if (!Number.isInteger(m?.findCount) || m.findCount < 1 || (surface && m.findCount > surface.hotspots.length)) {
      problems.push(`${world}: findCount must be a whole number from 1 to the number of dots on the picture${surface ? ` (${surface.hotspots.length})` : ''}`);
    }
    if (!isText(m?.done) || words(m.done) > MISSION_LIMITS.doneWords) problems.push(`${world}: done is required and at most ${MISSION_LIMITS.doneWords} words`);
    if (!isText(m?.teaser) || words(m.teaser) > MISSION_LIMITS.teaserWords) problems.push(`${world}: teaser is required and at most ${MISSION_LIMITS.teaserWords} words`);
    if (!isText(m?.teaserWorld) || !worldIds.includes(m.teaserWorld)) problems.push(`${world}: teaserWorld must be a world in planets.json`);
  }
  return problems;
}

export async function loadMissions(surfaces: SurfaceData, worldIds: string[], url = '/data/missions.json'): Promise<MissionData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const raw: unknown = await response.json();
  const problems = validateMissions(raw, surfaces, worldIds);
  if (problems.length > 0) throw new Error(`Bad mission data:\n${problems.join('\n')}`);
  return raw as MissionData;
}
