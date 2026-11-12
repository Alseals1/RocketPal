/**
 * Missions (docs/TECHNICAL_ARCHITECTURE.md section 4.7). A mission is done when its `goal` condition is met: that is
 * worked out from the save, never stored. Only `find` missions exist today; the other kinds, `rescue` and chapters
 * arrive with their own issues. See decisions/2026-11-12-events-conditions-progression.md (D7).
 */
import { validateCondition, type Condition, type ConditionContext } from './conditions';
import type { ChapterId, MissionId, PlaceId } from './ids';
import type { SurfaceData } from './surfaces';
import { isRealDate, isText, words } from './text';

export interface MissionDef {
  id: MissionId;
  kind: 'find' | 'tour' | 'side' | 'rescue' | 'request';
  /** Where it happens (for "Go" on the mission board). */
  place?: PlaceId;
  /** Tour steps. */
  chapter?: ChapterId;
  /** What Orbit asks the kid to do, for example "Find 3 things on Mars". At most 40 characters. */
  title: string;
  /** Done when this is met (derived, never stored). */
  goal: Condition;
  /** Shown only once this is met (requests, rescues). */
  available?: Condition;
  /** What Orbit says when the mission is done. */
  done: string;
  /** A friendly cliffhanger about the next world, shown after the quiz. */
  teaser?: { text: string; place: PlaceId };
}

export interface MissionData {
  lastChecked: string;
  missions: MissionDef[];
}

export const MISSION_LIMITS = { titleChars: 40, doneWords: 20, teaserWords: 20 };

const MISSION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** What a mission may point at: the conditions' context, and the worlds a teaser may name. */
export type MissionContext = ConditionContext & { worldIds: readonly string[] };

/** The `find` mission at a place, if there is one. */
export function findMissionAt(content: { missions: ReadonlyMap<string, MissionDef> }, place: string): MissionDef | undefined {
  for (const m of content.missions.values()) if (m.kind === 'find' && m.place === place) return m;
  return undefined;
}

/** How many dots a `find` mission asks for (0 for any other goal). */
export function findCountOf(m: MissionDef): number {
  return m.goal.type === 'dotsFound' ? m.goal.count : 0;
}

/** The name a mission's problems start with. */
export function missionLabel(raw: unknown): string {
  const id = (raw as Record<string, unknown> | null)?.id;
  return typeof id === 'string' && MISSION_ID.test(id) ? id : '(mission without an id)';
}

/** Returns a list of problems in the mission data, checked against the landing pictures. An empty list means it is valid. */
export function validateMissions(raw: unknown, surfaces: SurfaceData, worldIds: readonly string[]): string[] {
  const problems = validateMissionsFile(raw);
  const missions = (raw as Record<string, unknown> | null)?.missions;
  if (!Array.isArray(missions)) return problems;

  const ctx: MissionContext = {
    places: new Set(worldIds),
    dotsAt: (place) => surfaces.surfaces.find((s) => s.worldId === place)?.hotspots.length,
    quizPlaces: new Set(),
    missionIds: new Set(missions.map(missionLabel)),
    worldIds,
  };
  const seen = new Set<string>();
  const findAt = new Set<string>();
  for (const m of missions as Record<string, any>[]) {
    const id = missionLabel(m);
    if (seen.has(id)) problems.push(`${id}: listed twice`);
    seen.add(id);
    const mine = validateMission(m, ctx);
    problems.push(...mine);
    if (mine.length === 0 && m.kind === 'find') {
      if (findAt.has(m.place)) problems.push(`${id}: ${m.place} already has a find mission`);
      findAt.add(m.place);
    }
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
 * The checks on one mission. Only `find` missions are accepted today: a `place` with a landing picture, a goal of
 * `dotsFound` at that same place, and a teaser that points at a world.
 */
export function validateMission(raw: unknown, ctx: MissionContext): string[] {
  const m = raw as Record<string, any>; // typed loosely: every read allows for a missing field
  const label = missionLabel(m);
  const problems: string[] = [];
  const say = (problem: string) => problems.push(`${label}: ${problem}`);
  if (label !== m?.id) say('id is required: lowercase letters, digits and dashes, at most 40 characters');
  if (m?.kind !== 'find') say('kind must be "find" (other kinds come with their own issues)');
  const place = typeof m?.place === 'string' ? m.place : undefined;
  const isWorld = place !== undefined && ctx.worldIds.includes(place);
  if (!isWorld) say('place must be a world in planets.json');
  else if (ctx.dotsAt(place) === undefined) say('has a mission but no landing picture');
  if (!isText(m?.title) || m.title.length > MISSION_LIMITS.titleChars) say(`title is required and at most ${MISSION_LIMITS.titleChars} characters`);
  if (m?.goal?.type !== 'dotsFound' || m.goal.place !== place) say("a find mission's goal must be dotsFound at its own place");
  problems.push(...validateCondition(m?.goal, ctx, `${label}: goal`));
  if (m?.available !== undefined) problems.push(...validateCondition(m.available, ctx, `${label}: available`));
  if (!isText(m?.done) || words(m.done) > MISSION_LIMITS.doneWords) say(`done is required and at most ${MISSION_LIMITS.doneWords} words`);
  const teaser = m?.teaser;
  if (!isText(teaser?.text) || words(teaser.text) > MISSION_LIMITS.teaserWords) say(`teaser text is required and at most ${MISSION_LIMITS.teaserWords} words`);
  if (typeof teaser?.place !== 'string' || !ctx.worldIds.includes(teaser.place)) say('teaser place must be a world in planets.json');
  return problems;
}
