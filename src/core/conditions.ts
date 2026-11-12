/**
 * Conditions: one language for missions, patches and unlocks (docs/TECHNICAL_ARCHITECTURE.md section 4.3).
 * `isMet` and `progressOf` are pure: they read the save and the content and never store anything.
 *
 * The `Condition` type lives in `src/data/conditions.ts` (mission data holds conditions) and is re-exported here.
 * A `find` mission also counts as done when a v1 save says so (`worlds[place].missionDone`), so no old save loses a
 * mission or a star. See decisions/2026-11-12-events-conditions-progression.md (D2, D6).
 */
import type { Condition } from '../data/conditions';
import type { Content } from '../data/content';
import type { DotId, MissionId, PlaceId } from '../data/ids';
import type { SaveData } from './save/schema';

export type { Condition } from '../data/conditions';

/** The parts of `Content` conditions read. */
export type ConditionContent = Pick<Content, 'places' | 'arrivals' | 'missions'>;

type Progress = { done: number; of: number };

const own = <T>(record: Record<string, T>, key: string): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

/** True when the save meets the condition. Never stores anything. */
export function isMet(c: Condition, save: SaveData, content: ConditionContent): boolean {
  return met(c, save, content, new Set());
}

/** How far along the condition is, for progress bars ("2 of 3 found"). `done === of` exactly when it is met. */
export function progressOf(c: Condition, save: SaveData, content: ConditionContent): Progress {
  return progress(c, save, content, new Set());
}

/** The dots found at a place, ever, in the order of its landing picture. Ids the picture does not have are ignored. */
export function dotsFoundAt(save: SaveData, content: Pick<Content, 'arrivals'>, place: string): DotId[] {
  const arrival = content.arrivals.get(place as PlaceId);
  if (!arrival) return [];
  const found = new Set(save.dots);
  return arrival.hotspots.map((h) => `${place}/${h.id}` as DotId).filter((id) => found.has(id));
}

/** The quiz at a place: finished, and finished with every answer right first time. Reads the v2 record and the v1 flags. */
export function quizState(save: SaveData, place: string): { done: boolean; perfect: boolean } {
  const quiz = own(save.quizzes, place);
  const world = own(save.worlds, place);
  return {
    done: quiz?.done === true || world?.quizDone === true,
    perfect: quiz?.perfect === true || world?.perfectQuiz === true,
  };
}

/** A mission is done when its goal is met, or (a `find` mission) when a v1 save says so. An unknown mission is not done. */
export function isMissionDone(save: SaveData, content: ConditionContent, id: MissionId, seen: ReadonlySet<MissionId> = new Set()): boolean {
  const mission = content.missions.get(id);
  if (!mission || seen.has(id)) return false; // `seen` stops two missions that wait for each other
  if (doneByV1Flag(save, mission)) return true;
  return met(mission.goal, save, content, new Set(seen).add(id));
}

/** A mission's progress. One done by the v1 flag shows as complete. */
export function missionProgress(save: SaveData, content: ConditionContent, id: MissionId): Progress {
  const mission = content.missions.get(id);
  if (!mission) return { done: 0, of: 1 };
  const p = progress(mission.goal, save, content, new Set([id]));
  return doneByV1Flag(save, mission) ? { done: p.of, of: p.of } : p;
}

/**
 * Stars on a place, 0 to 3: the mission (the v1 flag, or a `find` mission there done), the quiz, and a perfect quiz.
 * They only go up, because each comes from facts that only go up.
 */
export function starsAtPlace(save: SaveData, content: ConditionContent, place: string): number {
  const missionStar =
    own(save.worlds, place)?.missionDone === true ||
    [...content.missions.values()].some((m) => m.kind === 'find' && m.place === place && isMissionDone(save, content, m.id));
  const quiz = quizState(save, place);
  return Number(missionStar) + Number(quiz.done) + Number(quiz.perfect);
}

function doneByV1Flag(save: SaveData, mission: { kind: string; place?: string }): boolean {
  return mission.kind === 'find' && mission.place !== undefined && own(save.worlds, mission.place)?.missionDone === true;
}

function met(c: Condition, save: SaveData, content: ConditionContent, seen: ReadonlySet<MissionId>): boolean {
  switch (c.type) {
    case 'all':
      return c.of.every((child) => met(child, save, content, seen));
    case 'any':
      return c.of.some((child) => met(child, save, content, seen));
    case 'missionDone':
      return isMissionDone(save, content, c.mission, seen);
    default: {
      const p = progress(c, save, content, seen);
      return p.done === p.of;
    }
  }
}

/** `of` is never below 0 and `done` never above `of`, so `done === of` is the same as "met" for every kind. */
function counted(have: number, need: number): Progress {
  const of = Math.max(0, need);
  return { done: Math.min(have, of), of };
}
const yesNo = (yes: boolean): Progress => ({ done: yes ? 1 : 0, of: 1 });

function progress(c: Condition, save: SaveData, content: ConditionContent, seen: ReadonlySet<MissionId>): Progress {
  switch (c.type) {
    case 'visited':
      return yesNo(save.visited.includes(c.place));
    case 'dotsFound':
      return counted(dotsFoundAt(save, content, c.place).length, c.count);
    case 'quizDone': {
      const quiz = quizState(save, c.place);
      return yesNo(c.perfect ? quiz.perfect : quiz.done);
    }
    case 'starsAt':
      // Course stars come with the courses (#51): until then a course id has none.
      return counted(content.places.has(c.place as PlaceId) ? starsAtPlace(save, content, c.place) : 0, c.count);
    case 'courseDone': {
      const course = own(save.courses, c.course);
      return yesNo(course?.[c.star ?? 'finish'] === true);
    }
    case 'capsules':
      return counted(save.capsules.length, c.count);
    case 'activityDone':
      return yesNo(
        c.key === undefined ? save.activities.some((a) => a.startsWith(`${c.activity}:`)) : save.activities.includes(`${c.activity}:${c.key}`),
      );
    case 'missionDone':
      return yesNo(isMissionDone(save, content, c.mission, seen));
    case 'all':
      return { done: c.of.filter((child) => met(child, save, content, seen)).length, of: c.of.length };
    case 'any':
      return yesNo(c.of.some((child) => met(child, save, content, seen)));
    // Chapters, ranks and patches come with #47, #46 and #54. Until then they are never met (and data cannot use them).
    case 'chapterDone':
    case 'rank':
    case 'patch':
      return { done: 0, of: 1 };
  }
}
