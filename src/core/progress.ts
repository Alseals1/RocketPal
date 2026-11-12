/**
 * Stars on a world, worked out from the saved flags (never stored), and the two things that earn them.
 * The save format and how it merges are in `./save/schema.ts`; reading and writing it is `src/platform/saveStore.ts`.
 */

/** What a kid has done on one world. Each flag only ever turns on. */
export interface WorldProgress {
  missionDone: boolean;
  quizDone: boolean;
  /** The quiz was finished with every question right on the first try. */
  perfectQuiz: boolean;
}

/** Anything with per-world flags: a v2 save (`SaveData`) is one. */
export interface Progress {
  worlds: Record<string, WorldProgress>;
}

const NOTHING_DONE: WorldProgress = { missionDone: false, quizDone: false, perfectQuiz: false };

export function emptyProgress(): Progress {
  return { worlds: {} };
}

/** Stars for one world, 0 to 3: the mission, finishing the quiz, and a bonus for a perfect quiz. They only go up. */
export function starsFor(progress: Progress, worldId: string): number {
  const w = Object.hasOwn(progress.worlds, worldId) ? progress.worlds[worldId] : NOTHING_DONE;
  return Number(w.missionDone) + Number(w.quizDone) + Number(w.perfectQuiz);
}

/** Changes one world's entry and keeps everything else: other worlds, other fields, and fields this code does not know. */
function update<P extends Progress>(progress: P, worldId: string, change: (w: WorldProgress) => WorldProgress): P {
  const current = Object.hasOwn(progress.worlds, worldId) ? progress.worlds[worldId] : NOTHING_DONE;
  return { ...progress, worlds: { ...progress.worlds, [worldId]: change(current) } };
}

export function recordMission<P extends Progress>(progress: P, worldId: string): P {
  return update(progress, worldId, (w) => ({ ...w, missionDone: true }));
}

/** The quiz was finished. A perfect result turns the bonus on; a worse replay never turns anything off. */
export function recordQuiz<P extends Progress>(progress: P, worldId: string, perfect: boolean): P {
  return update(progress, worldId, (w) => ({ ...w, quizDone: true, perfectQuiz: w.perfectQuiz || perfect }));
}
