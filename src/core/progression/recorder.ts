/**
 * The progression recorder: the only code that changes the save (docs/TECHNICAL_ARCHITECTURE.md section 5.2).
 * `record` is pure. It never changes its input, keeps fields it does not know at every level, and ignores anything
 * the content does not have. It also writes the v1 flags (`worlds[place]`), so a tab still running v1 code, or a
 * rollback, still shows every star. See decisions/2026-11-12-events-conditions-progression.md (D3, D4).
 */
import type { Content } from '../../data/content';
import type { PlaceId } from '../../data/ids';
import { isMet, quizState } from '../conditions';
import type { GameEvent } from '../events';
import type { SaveData, WorldSave } from '../save/schema';

/** The events the recorder writes down. Every other event leaves the save as it is. */
export const RECORDED_EVENTS = ['arrived', 'dotFound', 'quizFinished'] as const satisfies readonly GameEvent['type'][];

export type RecorderContent = Pick<Content, 'places' | 'arrivals' | 'missions' | 'quizzes' | 'progression'>;

const own = <T>(record: Record<string, T>, key: string): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);
const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();
const NOTHING_DONE: WorldSave = { missionDone: false, quizDone: false, perfectQuiz: false };

/** The save after the event. Returns `save` itself when the event changes nothing. */
export function record(save: SaveData, event: GameEvent, content: RecorderContent): SaveData {
  switch (event.type) {
    case 'arrived': {
      if (!content.places.has(event.place) || save.visited.includes(event.place)) return save;
      return { ...save, visited: sortedUnique([...save.visited, event.place]) };
    }
    case 'dotFound': {
      const at = event.dot.indexOf('/');
      const place = event.dot.slice(0, at) as PlaceId;
      const id = event.dot.slice(at + 1);
      if (at < 0 || !content.arrivals.get(place)?.hotspots.some((h) => h.id === id)) return save;
      if (save.dots.includes(event.dot)) return bumpRepeat(save, `dot:${event.dot}`, content);
      let next: SaveData = { ...save, dots: sortedUnique([...save.dots, event.dot]) };
      for (const m of content.missions.values()) {
        if (m.kind !== 'find' || m.place !== place || own(next.worlds, place)?.missionDone === true) continue;
        if (isMet(m.goal, next, content)) next = setWorld(next, place, { missionDone: true });
      }
      return next;
    }
    case 'quizFinished': {
      const { place, firstTryAll } = event;
      if (!content.quizzes.has(place)) return save;
      let next = quizState(save, place).done ? bumpRepeat(save, `quiz:${place}`, content) : save;
      const old = own(next.quizzes, place);
      next = { ...next, quizzes: { ...next.quizzes, [place]: { ...old, done: true, perfect: old?.perfect === true || firstTryAll } } };
      const world = own(next.worlds, place);
      return setWorld(next, place, { quizDone: true, perfectQuiz: world?.perfectQuiz === true || firstTryAll });
    }
    default:
      return save;
  }
}

/** Counts one more replay, up to `repeatCap`. At the cap the save is returned unchanged. */
function bumpRepeat(save: SaveData, key: string, content: RecorderContent): SaveData {
  const old = own(save.repeats, key) ?? 0;
  const n = Math.min(old + 1, content.progression.repeatCap);
  return n > old ? { ...save, repeats: { ...save.repeats, [key]: n } } : save;
}

/** Sets v1 flags on one world, creating its entry if needed, and keeps every other field. */
function setWorld(save: SaveData, place: string, flags: Partial<WorldSave>): SaveData {
  const world = own(save.worlds, place) ?? NOTHING_DONE;
  return { ...save, worlds: { ...save.worlds, [place]: { ...world, ...flags } } };
}
