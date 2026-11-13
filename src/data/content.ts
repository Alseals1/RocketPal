import { WORLD_IDS, type PlaceId, type WorldId } from './ids';
import { validateMission, validateMissionsFile, type Mission } from './missions';
import { validatePlanetsFile, validateWorld, type World } from './planets';
import { FALLBACK_RULES, validateProgression, type ProgressionRules } from './progression';
import { validateQuiz, validateQuizzesFile, type Quiz } from './quizzes';
import { validateSurface, validateSurfacesFile, type Surface } from './surfaces';

/** A Star Map destination (docs/TECHNICAL_ARCHITECTURE.md section 4.2). */
export interface Place {
  id: PlaceId;
  name: string;
  kind: 'world' | 'region';
  /** Position on the Star Map, from the Sun outwards. */
  order: number;
}

/**
 * Everything loaded from public/data/, validated, indexed. Read-only after start.
 *
 * Only the parts today's content uses (section 4.2 lists the rest, which come with their own issues). The entries keep
 * today's types for now: arrivals become `ArrivalDef`, quizzes `QuestionPool` and missions `MissionDef` later.
 * See decisions/2026-11-11-content-loader-interim-types.md.
 */
export interface Content {
  places: Map<PlaceId, Place>;
  worlds: Map<WorldId, World>; // planets.json
  arrivals: Map<PlaceId, Surface>; // surfaces.json
  quizzes: Map<PlaceId, Quiz>; // quizzes.json
  missions: Map<PlaceId, Mission>; // missions.json
  progression: ProgressionRules; // progression.json: the XP table and the ranks
  /** Entries left out by validation, each as "<file>.json: <why>". Logged; must be empty in tests. */
  problems: string[];
}

/** The data files as fetched. `undefined` means the file could not be loaded. */
export interface RawContent {
  planets: unknown;
  surfaces?: unknown;
  missions?: unknown;
  quizzes?: unknown;
  progression?: unknown;
}

type FileName = keyof RawContent;

/** How the console names each file's entries and data, in the same words the old loaders used. */
const WORDING: Record<FileName, { entries: string; data: string }> = {
  planets: { entries: 'worlds', data: 'planets' },
  surfaces: { entries: 'landing pictures', data: 'surface' },
  quizzes: { entries: 'quizzes', data: 'quiz' },
  missions: { entries: 'missions', data: 'mission' },
  progression: { entries: 'progression rules', data: 'progression' },
};

const FILES: FileName[] = ['planets', 'surfaces', 'quizzes', 'missions', 'progression'];

/**
 * Validates the data files entry by entry and indexes what is left. A bad entry is left out, with the entries that
 * point at it (a world takes its moon, landing picture, quiz and mission; a landing picture takes its quiz and
 * mission), and the rest still loads. The first copy of anything listed twice is kept. Each file that lost something
 * logs one console error. progression.json is checked as a whole: if it is missing or broken, no XP is given
 * (`FALLBACK_RULES`) and the rest still works. Throws only if planets.json is unusable as a whole or keeps no world at all.
 */
export function buildContent(raw: RawContent): Content {
  const found: Record<FileName, string[]> = { planets: [], surfaces: [], quizzes: [], missions: [], progression: [] };
  const fileFailed = new Set<FileName>();
  const notLoaded = new Set<FileName>(); // loadContent has already logged why

  /** The file's entry list, or `undefined` (with its problems noted) if the file is unusable as a whole. */
  const entriesOf = (file: FileName, check: (raw: unknown) => string[], listKey: string): unknown[] | undefined => {
    const data = raw[file];
    if (data === undefined && file !== 'planets') {
      found[file].push('could not be loaded');
      notLoaded.add(file);
      return undefined;
    }
    const problems = check(data);
    if (problems.length > 0) {
      found[file].push(...problems);
      fileFailed.add(file);
      return undefined;
    }
    return (data as Record<string, unknown[]>)[listKey];
  };

  /** Runs `check` on each entry and keeps the first good copy for each key. */
  const keep = <T>(file: FileName, list: unknown[] | undefined, keyOf: (entry: T) => string, check: (entry: unknown) => string[], twice: (key: string) => string) => {
    const kept = new Map<string, T>();
    for (const item of list ?? []) {
      const problems = check(item);
      if (problems.length > 0) {
        found[file].push(...problems);
        continue;
      }
      const key = keyOf(item as T);
      if (kept.has(key)) found[file].push(twice(key));
      else kept.set(key, item as T);
    }
    return kept;
  };

  // Worlds. A moon whose parent was left out goes too, then any of the ten that is not here is noted.
  const worldList = entriesOf('planets', validatePlanetsFile, 'worlds');
  if (!worldList) throw new Error(`Bad planets data:\n${found.planets.join('\n')}`);
  const worlds = keep<World>('planets', worldList, (w) => w.id, validateWorld, (id) => `${id}: listed twice (kept the first)`) as Map<WorldId, World>;
  for (const w of [...worlds.values()]) {
    if (w.kind === 'moon' && !worlds.has(w.parent as WorldId)) {
      found.planets.push(`${w.id}: parent "${w.parent}" is not a world in the list`);
      worlds.delete(w.id as WorldId);
    }
  }
  for (const id of WORLD_IDS) {
    if (!worlds.has(id)) found.planets.push(`${id}: world is missing`);
  }
  if (worlds.size === 0) throw new Error(`Bad planets data:\n${found.planets.join('\n')}`);

  const places = new Map<PlaceId, Place>();
  for (const [id, w] of worlds) places.set(id, { id, name: w.name, kind: 'world', order: WORLD_IDS.indexOf(id) });

  const worldIds = [...worlds.keys()];
  const arrivals = keep<Surface>(
    'surfaces',
    entriesOf('surfaces', validateSurfacesFile, 'surfaces'),
    (s) => s.worldId,
    (s) => validateSurface(s, worldIds),
    (id) => `${id}: listed twice (kept the first)`,
  ) as Map<PlaceId, Surface>;
  const arrivalFor = (entry: unknown) => arrivals.get((entry as { worldId?: unknown } | null)?.worldId as PlaceId);
  const quizzes = keep<Quiz>(
    'quizzes',
    entriesOf('quizzes', validateQuizzesFile, 'quizzes'),
    (q) => q.worldId,
    (q) => validateQuiz(q, arrivalFor(q)),
    (id) => `${id}: has a quiz more than once (kept the first)`,
  ) as Map<PlaceId, Quiz>;
  const missions = keep<Mission>(
    'missions',
    entriesOf('missions', validateMissionsFile, 'missions'),
    (m) => m.worldId,
    (m) => validateMission(m, arrivalFor(m), worldIds),
    (id) => `${id}: has a mission more than once (kept the first)`,
  ) as Map<PlaceId, Mission>;

  // The XP table and the ranks: all or nothing.
  const rulesList = entriesOf('progression', validateProgression, 'ranks');
  const progression = rulesList ? (raw.progression as ProgressionRules) : structuredClone(FALLBACK_RULES);

  const problems: string[] = [];
  for (const file of FILES) {
    const list = found[file];
    if (list.length > 0 && !notLoaded.has(file)) {
      const { entries, data } = WORDING[file];
      console.error(fileFailed.has(file) ? `Bad ${data} data:\n${list.join('\n')}` : `Some ${entries} were left out:\n${list.join('\n')}`);
    }
    problems.push(...found[file].map((p) => `${file}.json: ${p}`));
  }
  return { places, worlds, arrivals, quizzes, missions, progression, problems };
}

/**
 * Fetches the data files at the same time and builds the game's content from them. A file other than
 * planets.json that cannot be loaded is logged and left out: the game still flies and lands without it.
 * Rejects if planets.json cannot be loaded or is unusable as a whole.
 */
export async function loadContent(base = '/data/'): Promise<Content> {
  const [planets, surfaces, missions, quizzes, progression] = await Promise.all([
    fetchJson(`${base}planets.json`, true),
    fetchJson(`${base}surfaces.json`),
    fetchJson(`${base}missions.json`),
    fetchJson(`${base}quizzes.json`),
    fetchJson(`${base}progression.json`),
  ]);
  return buildContent({ planets, surfaces, missions, quizzes, progression });
}

/** The parsed file, or `undefined` (logged) if it cannot be loaded. A required file throws instead. */
async function fetchJson(url: string, required = false): Promise<unknown> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const problem = message.startsWith('Could not load') ? message : `Could not load ${url} (${message})`;
    if (required) throw new Error(problem);
    console.error(problem);
    return undefined;
  }
}
