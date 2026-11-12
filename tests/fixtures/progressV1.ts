/**
 * THE OLD CODE PATH. A frozen, verbatim copy of the v1 save code from `src/core/progress.ts` at commit 1861228,
 * before save v2 (#29). Tests use it to play a browser tab that was left open from before the update and still saves
 * the old way. It must never change: if it did, the tests would stop proving that an old tab cannot wipe 2.0 progress.
 */
import type { SettingsStorage } from '../../src/core/settings';

export interface WorldProgressV1 {
  missionDone: boolean;
  quizDone: boolean;
  perfectQuiz: boolean;
}

export interface ProgressV1 {
  worlds: Record<string, WorldProgressV1>;
}

const PROGRESS_KEY = 'rocketpals.progress';
const VERSION = 1;
const WORLD_ID = /^[a-z][a-z0-9-]{0,30}$/;

const NOTHING_DONE: WorldProgressV1 = { missionDone: false, quizDone: false, perfectQuiz: false };

export function emptyProgressV1(): ProgressV1 {
  return { worlds: {} };
}

function update(progress: ProgressV1, worldId: string, change: (w: WorldProgressV1) => WorldProgressV1): ProgressV1 {
  const current = Object.hasOwn(progress.worlds, worldId) ? progress.worlds[worldId] : NOTHING_DONE;
  return { worlds: { ...progress.worlds, [worldId]: change(current) } };
}

export function recordMissionV1(progress: ProgressV1, worldId: string): ProgressV1 {
  return update(progress, worldId, (w) => ({ ...w, missionDone: true }));
}

export function mergeProgressV1(a: ProgressV1, b: ProgressV1): ProgressV1 {
  const worlds: Record<string, WorldProgressV1> = {};
  for (const id of new Set([...Object.keys(a.worlds), ...Object.keys(b.worlds)])) {
    const x = Object.hasOwn(a.worlds, id) ? a.worlds[id] : NOTHING_DONE;
    const y = Object.hasOwn(b.worlds, id) ? b.worlds[id] : NOTHING_DONE;
    worlds[id] = {
      missionDone: x.missionDone || y.missionDone,
      quizDone: x.quizDone || y.quizDone,
      perfectQuiz: x.perfectQuiz || y.perfectQuiz,
    };
  }
  return { worlds };
}

export function loadProgressV1(storage: SettingsStorage | null): ProgressV1 {
  let raw: unknown;
  try {
    const text = storage?.getItem(PROGRESS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    return emptyProgressV1();
  }
  const worlds = isObject(raw) ? raw.worlds : null;
  if (!isObject(worlds)) return emptyProgressV1();

  const progress = emptyProgressV1();
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

export function saveProgressV1(progress: ProgressV1, storage: SettingsStorage | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: VERSION, worlds: progress.worlds }));
    return true;
  } catch {
    return false;
  }
}

/** What an old tab does when the kid finishes a mission: read what is saved, merge with its own memory, record, save. */
export function oldTabEarnsMission(storage: SettingsStorage, memory: ProgressV1, worldId: string): ProgressV1 {
  const next = recordMissionV1(mergeProgressV1(loadProgressV1(storage), memory), worldId);
  saveProgressV1(next, storage);
  return next;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
