/**
 * THE OLD CODE PATH, for the browser. What a tab left open from before save v2 (#29) does when the kid finishes a
 * mission: today's v1 load (keeps only the per-world flags), merge with its own empty memory, record, and save
 * `{ version: 1, worlds }` over `rocketpals.progress`. A frozen copy of `src/core/progress.ts` at commit 1861228
 * (the unit tests use the same code in `tests/fixtures/progressV1.ts`). It must never change.
 *
 * Self-contained, with no imports and no closures, so it can be passed to `page.evaluate`.
 */
export function oldWindowEarnsMission(worldId: string): void {
  type World = { missionDone: boolean; quizDone: boolean; perfectQuiz: boolean };
  const KEY = 'rocketpals.progress';
  const WORLD_ID = /^[a-z][a-z0-9-]{0,30}$/;
  const NOTHING_DONE: World = { missionDone: false, quizDone: false, perfectQuiz: false };
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

  // loadProgress
  let raw: unknown = null;
  try {
    const text = localStorage.getItem(KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const loaded: Record<string, World> = {};
  const saved = isObject(raw) ? raw.worlds : null;
  if (isObject(saved)) {
    for (const id of Object.keys(saved)) {
      const w = saved[id];
      if (!WORLD_ID.test(id) || !isObject(w)) continue;
      loaded[id] = { missionDone: w.missionDone === true, quizDone: w.quizDone === true, perfectQuiz: w.perfectQuiz === true };
    }
  }

  // mergeProgress(loaded, its own memory: nothing), then recordMission
  const memory: Record<string, World> = {};
  const worlds: Record<string, World> = {};
  for (const id of new Set([...Object.keys(loaded), ...Object.keys(memory)])) {
    const x = Object.hasOwn(loaded, id) ? loaded[id] : NOTHING_DONE;
    const y = Object.hasOwn(memory, id) ? memory[id] : NOTHING_DONE;
    worlds[id] = { missionDone: x.missionDone || y.missionDone, quizDone: x.quizDone || y.quizDone, perfectQuiz: x.perfectQuiz || y.perfectQuiz };
  }
  const current = Object.hasOwn(worlds, worldId) ? worlds[worldId] : NOTHING_DONE;
  const next = { ...worlds, [worldId]: { ...current, missionDone: true } };

  // saveProgress
  localStorage.setItem(KEY, JSON.stringify({ version: 1, worlds: next }));
}
