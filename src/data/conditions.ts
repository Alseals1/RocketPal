/**
 * The `Condition` type (docs/TECHNICAL_ARCHITECTURE.md section 4.3) and its data check. The type lives here, in the
 * Content layer, because mission data (`MissionDef.goal`) holds conditions and Content may import only Content. Logic
 * re-exports it from `src/core/conditions.ts`, which also holds `isMet` and `progressOf`.
 * See decisions/2026-11-12-events-conditions-progression.md (D1, D6).
 */
import type { ActivityId, ChapterId, CourseId, MissionId, PatchId, PlaceId } from './ids';

export type Condition =
  | { type: 'visited'; place: PlaceId }
  | { type: 'dotsFound'; place: PlaceId; count: number } // count of that place's dots found, ever
  | { type: 'quizDone'; place: PlaceId; perfect?: boolean }
  | { type: 'starsAt'; place: PlaceId | CourseId; count: number }
  | { type: 'courseDone'; course: CourseId; star?: 'finish' | 'crystals' | 'smooth' }
  | { type: 'capsules'; count: number }
  | { type: 'activityDone'; activity: ActivityId; key?: string } // key: a world for per-world mini-games
  | { type: 'missionDone'; mission: MissionId }
  | { type: 'chapterDone'; chapter: ChapterId }
  | { type: 'rank'; atLeast: number }
  | { type: 'patch'; patch: PatchId }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] };

export const CONDITION_TYPES = [
  'visited',
  'dotsFound',
  'quizDone',
  'starsAt',
  'courseDone',
  'capsules',
  'activityDone',
  'missionDone',
  'chapterDone',
  'rank',
  'patch',
  'all',
  'any',
] as const satisfies readonly Condition['type'][];

/** What a condition in the data may point at. */
export interface ConditionContext {
  places: ReadonlySet<string>;
  /** The number of dots on the place's landing picture, or `undefined` when it has none. */
  dotsAt(place: string): number | undefined;
  quizPlaces: ReadonlySet<string>;
  missionIds: ReadonlySet<string>;
}

/** The kinds that data may use today. The rest come with the content they need (D6). */
const SUPPORTED = new Set<string>(['visited', 'dotsFound', 'quizDone', 'starsAt', 'capsules', 'missionDone', 'all', 'any']);

const isWhole = (n: unknown, min: number, max = Infinity): n is number => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/** Returns the problems with one condition in the data, each starting with `path`. An empty list means it is valid. */
export function validateCondition(raw: unknown, ctx: ConditionContext, path = 'goal'): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [`${path} must be a condition`];
  const c = raw as Record<string, unknown>;
  const type = typeof c.type === 'string' ? c.type : '';
  if (!type) return [`${path} needs a type`];
  if (!SUPPORTED.has(type)) return [`${path}: "${type}" is not supported yet`];
  const place = typeof c.place === 'string' ? c.place : '';
  const problems: string[] = [];
  const needPlace = () => {
    if (!ctx.places.has(place)) problems.push(`${path}: ${type} place must be a world in planets.json`);
  };
  switch (type) {
    case 'visited':
      needPlace();
      break;
    case 'dotsFound': {
      const dots = ctx.places.has(place) ? ctx.dotsAt(place) : undefined;
      if (dots === undefined) problems.push(`${path}: dotsFound place must be a world with a landing picture`);
      if (!isWhole(c.count, 1, dots ?? Infinity)) {
        problems.push(`${path}: dotsFound count must be a whole number from 1 to the number of dots on the picture${dots === undefined ? '' : ` (${dots})`}`);
      }
      break;
    }
    case 'quizDone':
      if (!ctx.quizPlaces.has(place)) problems.push(`${path}: quizDone place must be a world with a quiz`);
      if (c.perfect !== undefined && typeof c.perfect !== 'boolean') problems.push(`${path}: quizDone perfect must be true or false`);
      break;
    case 'starsAt':
      needPlace();
      if (!isWhole(c.count, 1, 3)) problems.push(`${path}: starsAt count must be a whole number from 1 to 3`);
      break;
    case 'capsules':
      if (!isWhole(c.count, 1)) problems.push(`${path}: capsules count must be a whole number of at least 1`);
      break;
    case 'missionDone':
      if (typeof c.mission !== 'string' || !ctx.missionIds.has(c.mission)) problems.push(`${path}: missionDone mission must be a mission in missions.json`);
      break;
    case 'all':
    case 'any':
      if (!Array.isArray(c.of) || c.of.length === 0) problems.push(`${path}: ${type} needs a list of at least one condition`);
      else c.of.forEach((child, i) => problems.push(...validateCondition(child, ctx, `${path}.of[${i}]`)));
      break;
  }
  return problems;
}
