/**
 * The saved progress, version 2 (#29). One record under `rocketpals.progress`. Every field says how two copies of it
 * merge, so a second open window, or an old tab left open from before an update, can never lose anything.
 *
 * Only facts are saved (what was found, finished, chosen). Stars, XP, ranks and unlocks are worked out from them and
 * never stored, so there is nothing to spend and a merge can never bring spent stars back.
 *
 * Pure logic: no DOM, no storage. `src/platform/saveStore.ts` reads and writes it.
 */

/** One world's flags (v1). Each only ever turns on. Fields from a newer version are kept. */
export interface WorldSave {
  missionDone: boolean;
  quizDone: boolean;
  /** The quiz was finished with every question right on the first try. */
  perfectQuiz: boolean;
  [unknown: string]: unknown;
}

export interface QuizSave {
  done: boolean;
  perfect: boolean;
  [unknown: string]: unknown;
}

export interface CourseSave {
  finish: boolean;
  crystals: boolean;
  smooth: boolean;
  /** Best time in milliseconds. Absent until the course is finished once. */
  bestMs?: number;
  [unknown: string]: unknown;
}

/** A choice the kid can change back and forth. The newest `at` (ms since 1970) wins a merge. */
export interface Stamped<T> {
  value: T;
  at: number;
}

/** The known fields, without an index signature, so `SAVE_SCHEMA` is checked against them. */
export interface SaveFields {
  version: 2;
  worlds: Record<string, WorldSave>; //                       merge: OR per flag (v1, kept)
  visited: string[]; //  PlaceIds                              merge: union
  dots: string[]; //     DotIds found                          merge: union
  capsules: string[]; // CapsuleIds                            merge: union
  quizzes: Record<string, QuizSave>; //                        merge: OR per flag
  courses: Record<string, CourseSave>; //                      merge: OR flags, min time
  activities: string[]; // `${ActivityId}:${key}` done         merge: union
  rescues: string[]; //  MissionIds                            merge: union
  repeats: Record<string, number>; // replay counters for XP    merge: max
  patchDates: Record<string, string>; // PatchId → first date  merge: earliest
  equipped: Record<string, { item: string; at: number }>; //   merge: newest `at`, per slot
  pilot: { callSign?: Stamped<string> }; //                    merge: newest `at`, per key
}

/** The whole record. Fields from a newer version are kept, never dropped. */
export interface SaveData extends SaveFields {
  [unknown: string]: unknown;
}

export type MergeRule = 'union' | 'or' | 'max' | 'min' | 'earliest' | 'newest' | 'keep';
type SaveField = Exclude<keyof SaveFields, 'version'>;

/**
 * How each field merges.
 * - `'union'`: a list of ids. The merge is the sorted set union, so it does not depend on which copy comes first.
 * - An object of rules: a record of entries (a world, a quiz, a course). Each listed entry field merges by its rule
 *   (`'or'` for flags, `'min'` for a best time); every other entry field is `'keep'`.
 * - Any other rule: a record whose values merge key by key by that rule. A key in only one copy is kept.
 * - `'keep'`: the first copy's value if it has one, else the second's. Used for every field this code does not know.
 *   It is the only rule that depends on order: the save store passes the stored copy first.
 */
export const SAVE_SCHEMA: Readonly<Record<SaveField, MergeRule | Readonly<Record<string, MergeRule>>>> = {
  worlds: { missionDone: 'or', quizDone: 'or', perfectQuiz: 'or' },
  visited: 'union',
  dots: 'union',
  capsules: 'union',
  quizzes: { done: 'or', perfect: 'or' },
  courses: { finish: 'or', crystals: 'or', smooth: 'or', bestMs: 'min' },
  activities: 'union',
  rescues: 'union',
  repeats: 'max',
  patchDates: 'earliest',
  equipped: 'newest',
  pilot: 'newest',
};

export const SAVE_VERSION = 2;

export function emptySave(): SaveData {
  return {
    version: 2,
    worlds: {},
    visited: [],
    dots: [],
    capsules: [],
    quizzes: {},
    courses: {},
    activities: [],
    rescues: [],
    repeats: {},
    patchDates: {},
    equipped: {},
    pilot: {},
  };
}

// ---- Upgrading and cleaning up what was stored ----

/** World ids look like "mars" (as in v1). */
const WORLD_ID = /^[a-z][a-z0-9-]{0,30}$/;
/** Every other id or key: letters, digits and a few separators, such as "mars:rim" or "ring-run". */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:/._-]{0,119}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Names that would reach the shared Object prototype if used as a key. They never become keys. */
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const ENTRY_ID: Partial<Record<SaveField, RegExp>> = { worlds: WORLD_ID };

/** Which values a keyed record keeps. Anything else is dropped, one key at a time. */
const VALID_VALUE: Partial<Record<SaveField, (v: unknown) => boolean>> = {
  repeats: (v) => Number.isInteger(v) && (v as number) >= 0,
  patchDates: (v) => typeof v === 'string' && DATE.test(v),
  equipped: (v) => isObject(v) && typeof v.item === 'string' && isTime(v.at),
};
/** For `pilot`, each known key has its own shape. Keys from a newer version are kept as they are. */
const VALID_PILOT: Record<string, (v: unknown) => boolean> = {
  callSign: (v) => isObject(v) && typeof v.value === 'string' && isTime(v.at),
};

/**
 * Turns whatever was stored into a v2 save. Never throws.
 * - Not an object: an empty save.
 * - No version, or not a number: version 1. Every version goes through the same field-by-field cleanup; the 1 → 2
 *   step only adds the new fields, empty. The result is always version 2.
 * - A field that is wrong falls back to empty on its own; the good fields are kept.
 * - Unknown fields are kept, at the top level and inside each entry.
 *
 * Rule for every later version: an upgrade only fills fields that are missing, and never changes the type of an
 * existing field. A v2 window can write `version: 2` over a v3 record (keeping v3's fields as unknown ones), so the
 * v3 upgrade must be safe to run again on such a record.
 */
export function migrate(raw: unknown): SaveData {
  if (!isObject(raw)) return emptySave();
  const save = emptySave();
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN.has(key) || key === 'version') continue;
    const value = raw[key];
    if (!Object.hasOwn(SAVE_SCHEMA, key)) {
      save[key] = value; // from a newer version: kept as it is
      continue;
    }
    const field = key as SaveField;
    const rule = SAVE_SCHEMA[field];
    if (rule === 'union') (save as Record<string, unknown>)[field] = cleanList(value);
    else if (typeof rule === 'object') (save as Record<string, unknown>)[field] = cleanEntries(value, rule, ENTRY_ID[field] ?? SAFE_ID);
    else if (field === 'pilot') save.pilot = cleanRecord(value, (k, v) => (Object.hasOwn(VALID_PILOT, k) ? VALID_PILOT[k](v) : true));
    else {
      const valid = VALID_VALUE[field] ?? (() => true);
      (save as Record<string, unknown>)[field] = cleanRecord(value, (_k, v) => valid(v));
    }
  }
  return save;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return sortedUnique(value.filter((x): x is string => typeof x === 'string' && SAFE_ID.test(x) && !FORBIDDEN.has(x)));
}

function cleanRecord(value: unknown, keep: (key: string, v: unknown) => boolean): Record<string, never> {
  const out: Record<string, unknown> = {};
  if (!isObject(value)) return out as Record<string, never>;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key) || !SAFE_ID.test(key) || !keep(key, value[key])) continue;
    out[key] = value[key];
  }
  return out as Record<string, never>;
}

function cleanEntries(value: unknown, rules: Readonly<Record<string, MergeRule>>, idPattern: RegExp): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isObject(value)) return out;
  for (const id of Object.keys(value)) {
    const entry = value[id];
    if (FORBIDDEN.has(id) || !idPattern.test(id) || !isObject(entry)) continue;
    const clean: Record<string, unknown> = {};
    for (const [name, rule] of Object.entries(rules)) if (rule === 'or') clean[name] = entry[name] === true;
    for (const name of Object.keys(entry)) {
      if (FORBIDDEN.has(name)) continue;
      const rule = Object.hasOwn(rules, name) ? rules[name] : 'keep';
      if (rule === 'min') {
        if (typeof entry[name] === 'number' && Number.isFinite(entry[name]) && (entry[name] as number) > 0) clean[name] = entry[name];
      } else if (rule === 'keep') clean[name] = entry[name];
    }
    out[id] = clean;
  }
  return out;
}

// ---- Merging two copies ----

/**
 * Two copies of the save become one that keeps everything either has, field by field, as `SAVE_SCHEMA` says.
 * For the known fields it gives the same answer whichever way round and however grouped, and merging a save with
 * itself changes nothing. Unknown fields: the first copy wins when both have one. Never changes its inputs.
 */
export function merge(a: SaveData, b: SaveData): SaveData {
  const out: Record<string, unknown> = { version: SAVE_VERSION };
  for (const key of unionKeys(a, b)) {
    if (key === 'version') continue;
    const rule: MergeRule | Readonly<Record<string, MergeRule>> = Object.hasOwn(SAVE_SCHEMA, key) ? SAVE_SCHEMA[key as SaveField] : 'keep';
    out[key] = mergeField(rule, a, b, key);
  }
  return out as SaveData;
}

function mergeField(rule: MergeRule | Readonly<Record<string, MergeRule>>, a: Record<string, unknown>, b: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(b, key)) return a[key];
  if (!Object.hasOwn(a, key)) return b[key];
  const x = a[key];
  const y = b[key];
  if (rule === 'keep') return x;
  if (rule === 'union') return sortedUnique([...asArray(x), ...asArray(y)]);
  const xs = asRecord(x);
  const ys = asRecord(y);
  const out: Record<string, unknown> = {};
  for (const k of unionKeys(xs, ys)) {
    if (!Object.hasOwn(ys, k)) out[k] = xs[k];
    else if (!Object.hasOwn(xs, k)) out[k] = ys[k];
    else out[k] = typeof rule === 'object' ? mergeEntry(rule, asRecord(xs[k]), asRecord(ys[k])) : pick(rule, xs[k], ys[k]);
  }
  return out;
}

function mergeEntry(rules: Readonly<Record<string, MergeRule>>, x: Record<string, unknown>, y: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of unionKeys(x, y)) {
    if (!Object.hasOwn(y, name)) out[name] = x[name];
    else if (!Object.hasOwn(x, name)) out[name] = y[name];
    else out[name] = pick(Object.hasOwn(rules, name) ? rules[name] : 'keep', x[name], y[name]);
  }
  return out;
}

/** One value from two, by a rule. Both are present. */
function pick(rule: MergeRule, x: unknown, y: unknown): unknown {
  switch (rule) {
    case 'or':
      return x === true || y === true;
    case 'min':
      return typeof x === 'number' && typeof y === 'number' ? Math.min(x, y) : x;
    case 'max':
      return typeof x === 'number' && typeof y === 'number' ? Math.max(x, y) : x;
    case 'earliest':
      return typeof x === 'string' && typeof y === 'string' ? (y < x ? y : x) : x;
    case 'newest': {
      const ax = isObject(x) && isTime(x.at) ? x.at : null;
      const ay = isObject(y) && isTime(y.at) ? y.at : null;
      if (ax === null || ay === null) return x; // no time to compare: keep
      if (ax !== ay) return ay > ax ? y : x;
      // A tie: the larger text wins, so the answer does not depend on which copy comes first.
      return JSON.stringify(y) > JSON.stringify(x) ? y : x;
    }
    case 'union':
      return sortedUnique([...asArray(x), ...asArray(y)]);
    case 'keep':
      return x;
  }
}

// ---- Small helpers ----

/** True when two saves hold the same data, whatever order their keys are in. */
export function sameSave(a: SaveData, b: SaveData): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );
}

/** The own keys of both, without the forbidden names, the first copy's order first. */
function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !FORBIDDEN.has(k));
}

function sortedUnique(xs: string[]): string[] {
  return [...new Set(xs)].sort();
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return isObject(v) ? v : {};
}

function isTime(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
