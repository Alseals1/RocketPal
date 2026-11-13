/**
 * Test helpers that set and read the v1 per-world flags (`worlds[id]`) directly. The save format and store tests use
 * them to write saves the way the game did before #39. The game itself now records through
 * `src/core/progression/recorder.ts` and works stars out with `deriveProgression`.
 */
import type { SaveData, WorldSave } from '../../src/core/save/schema';

type WithWorlds = Pick<SaveData, 'worlds'>;
const NOTHING_DONE: WorldSave = { missionDone: false, quizDone: false, perfectQuiz: false };
const world = (p: WithWorlds, id: string) => (Object.hasOwn(p.worlds, id) ? p.worlds[id] : NOTHING_DONE);

/** The v1 star formula: the mission, the quiz, and a perfect quiz. */
export function starsFor(p: WithWorlds, id: string): number {
  const w = world(p, id);
  return Number(w.missionDone === true) + Number(w.quizDone === true) + Number(w.perfectQuiz === true);
}

export function recordMission<P extends WithWorlds>(p: P, id: string): P {
  return { ...p, worlds: { ...p.worlds, [id]: { ...world(p, id), missionDone: true } } };
}

export function recordQuiz<P extends WithWorlds>(p: P, id: string, perfect: boolean): P {
  const w = world(p, id);
  return { ...p, worlds: { ...p.worlds, [id]: { ...w, quizDone: true, perfectQuiz: w.perfectQuiz || perfect } } };
}
