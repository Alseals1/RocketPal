import type { SettingsStorage } from './settings';

/** What a kid has done on one world. Each flag only ever turns on. */
export interface WorldProgress {
  missionDone: boolean;
  quizDone: boolean;
  /** The quiz was finished with every question right on the first try. */
  perfectQuiz: boolean;
}

export interface Progress {
  worlds: Record<string, WorldProgress>;
}

export const PROGRESS_KEY = 'rocketpals.progress';
const VERSION = 1;
/** World ids look like "mars". Anything else in saved data is ignored (this also keeps odd names like __proto__ out). */
const WORLD_ID = /^[a-z][a-z0-9-]{0,30}$/;

const NOTHING_DONE: WorldProgress = { missionDone: false, quizDone: false, perfectQuiz: false };

export function emptyProgress(): Progress {
  return { worlds: {} };
}

/** Stars for one world, 0 to 3: the mission, finishing the quiz, and a bonus for a perfect quiz. They only go up. */
export function starsFor(progress: Progress, worldId: string): number {
  const w = Object.hasOwn(progress.worlds, worldId) ? progress.worlds[worldId] : NOTHING_DONE;
  return Number(w.missionDone) + Number(w.quizDone) + Number(w.perfectQuiz);
}

function update(progress: Progress, worldId: string, change: (w: WorldProgress) => WorldProgress): Progress {
  const current = Object.hasOwn(progress.worlds, worldId) ? progress.worlds[worldId] : NOTHING_DONE;
  return { worlds: { ...progress.worlds, [worldId]: change(current) } };
}

export function recordMission(progress: Progress, worldId: string): Progress {
  return update(progress, worldId, (w) => ({ ...w, missionDone: true }));
}

/** The quiz was finished. A perfect result turns the bonus on; a worse replay never turns anything off. */
export function recordQuiz(progress: Progress, worldId: string, perfect: boolean): Progress {
  return update(progress, worldId, (w) => ({ ...w, quizDone: true, perfectQuiz: w.perfectQuiz || perfect }));
}

/** Reads the saved progress. Anything missing or wrong counts as "not done", one flag at a time. */
export function loadProgress(storage: SettingsStorage | null): Progress {
  let raw: unknown;
  try {
    const text = storage?.getItem(PROGRESS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    return emptyProgress();
  }
  const worlds = isObject(raw) ? raw.worlds : null;
  if (!isObject(worlds)) return emptyProgress();

  const progress = emptyProgress();
  for (const id of Object.keys(worlds)) {
    const saved = worlds[id];
    if (!WORLD_ID.test(id) || !isObject(saved)) continue;
    progress.worlds[id] = {
      missionDone: saved.missionDone === true,
      quizDone: saved.quizDone === true,
      perfectQuiz: saved.perfectQuiz === true,
    };
  }
  return progress;
}

/** Saves the progress. Returns false (and never throws) if the browser will not let us. */
export function saveProgress(progress: Progress, storage: SettingsStorage | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: VERSION, worlds: progress.worlds }));
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
