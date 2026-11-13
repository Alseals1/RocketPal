import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA, emptySave, merge, migrate, sameSave, type SaveData } from '../src/core/save/schema';
import { starsFor } from './fixtures/worldFlags';
import { NO_VERSION, V1_EARTH_MISSION, V1_MARS_3_EARTH_2, V2_FULL, V3_FROM_THE_FUTURE } from './fixtures/saves';

const EMPTY_V2_FIELDS = {
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

/** A save with only the given fields filled in. */
const save = (fields: Partial<SaveData>): SaveData => ({ ...emptySave(), ...fields });

describe('upgrading old saves', () => {
  it('a new save is version 2 with every field empty', () => {
    expect(emptySave()).toEqual({ version: 2, worlds: {}, ...EMPTY_V2_FIELDS });
  });

  for (const [name, fixture] of [
    ['v1, Earth mission only', V1_EARTH_MISSION],
    ['v1, Mars 3 and Earth 2', V1_MARS_3_EARTH_2],
    ['no version', NO_VERSION],
  ] as const) {
    it(`${name}: every flag and star is kept, and the new fields start empty`, () => {
      const s = migrate(JSON.parse(JSON.stringify(fixture)));
      expect(s).toEqual({ version: 2, worlds: fixture.worlds, ...EMPTY_V2_FIELDS });
      for (const id of Object.keys(fixture.worlds)) expect(starsFor(s, id)).toBe(starsFor(fixture, id));
    });
  }

  it('gives the stars the old save gave', () => {
    const s = migrate(V1_MARS_3_EARTH_2);
    expect(starsFor(s, 'mars')).toBe(3);
    expect(starsFor(s, 'earth')).toBe(2);
    expect(starsFor(s, 'venus')).toBe(0);
  });

  it('a full v2 save comes back exactly as it was', () => {
    expect(migrate(JSON.parse(JSON.stringify(V2_FULL)))).toEqual(V2_FULL);
  });

  it('does not change what it was given', () => {
    const raw = JSON.parse(JSON.stringify(V3_FROM_THE_FUTURE));
    migrate(raw);
    expect(raw).toEqual(V3_FROM_THE_FUTURE);
  });
});

describe('garbage', () => {
  it('starts empty, without throwing, for anything that is not a save', () => {
    for (const bad of [undefined, null, '', 'null', 42, '"hi"', 'not json {', [], [1, 2], true, () => 1]) {
      expect(migrate(bad), String(bad)).toEqual(emptySave());
    }
  });

  it('a wrong field falls back to empty on its own, and the good fields are kept', () => {
    const s = migrate({
      worlds: 7,
      visited: ['mars', 5, null, 'has space', 'earth', 'mars'],
      dots: 'x',
      capsules: { a: 1 },
      quizzes: [],
      courses: { 'ring-run': { finish: 'yes', crystals: true, smooth: 1, bestMs: -3 }, odd: 'nope', 'Bad Id': { finish: true } },
      repeats: { a: 2, b: -1, c: 1.5, d: '3', e: 0 },
      patchDates: { a: '2026-11-01', b: 'yesterday', c: 20261101 },
      equipped: { trim: { item: 'stripes', at: 5 }, hat: { item: 7, at: 5 }, cape: { item: 'red' }, fin: { item: 'x', at: Infinity } },
      pilot: { callSign: { value: 'Comet' } },
    });
    expect(s).toEqual({
      ...emptySave(),
      visited: ['earth', 'mars'],
      courses: { 'ring-run': { finish: false, crystals: true, smooth: false } },
      repeats: { a: 2, e: 0 },
      patchDates: { a: '2026-11-01' },
      equipped: { trim: { item: 'stripes', at: 5 } },
    });
  });

  it('keeps each world flag that is a real yes and nothing else, as v1 did', () => {
    const s = migrate({
      worlds: {
        mars: { missionDone: true, quizDone: 'yes', perfectQuiz: 1 },
        earth: { quizDone: true, perfectQuiz: true, missionDone: false },
        moon: 'nope',
        venus: null,
      },
    });
    expect(starsFor(s, 'mars')).toBe(1);
    expect(starsFor(s, 'earth')).toBe(2);
    expect(Object.keys(s.worlds).sort()).toEqual(['earth', 'mars']);
  });

  it('pilot.callSign with a bad value or time is dropped', () => {
    expect(migrate({ pilot: { callSign: { value: 3, at: 1 } } }).pilot).toEqual({});
    expect(migrate({ pilot: { callSign: { value: 'Zoom', at: 'soon' } } }).pilot).toEqual({});
    expect(migrate({ pilot: 'Zoom' }).pilot).toEqual({});
  });
});

describe('mischief in the saved text', () => {
  const NASTY = ['__proto__', 'constructor', 'prototype'];

  it('never turns __proto__, constructor or prototype into a key, at any level, and leaves Object.prototype alone', () => {
    const nested = NASTY.map((k) => `"${k}":{"missionDone":true,"done":true,"item":"x","at":1}`).join(',');
    const text = `{${NASTY.map((k) => `"${k}":{"polluted":true}`).join(',')},
      "worlds":{${nested},"mars":{"missionDone":true,${NASTY.map((k) => `"${k}":1`).join(',')}}},
      "quizzes":{${nested}}, "courses":{${nested}}, "repeats":{${NASTY.map((k) => `"${k}":1`).join(',')}},
      "patchDates":{${NASTY.map((k) => `"${k}":"2026-01-01"`).join(',')}}, "equipped":{${nested}},
      "pilot":{${nested}}}`;
    const s = migrate(JSON.parse(text));
    const hasNasty = (o: object) => NASTY.some((k) => Object.hasOwn(o, k));
    expect(hasNasty(s)).toBe(false);
    for (const field of ['worlds', 'quizzes', 'courses', 'repeats', 'patchDates', 'equipped', 'pilot'] as const) {
      expect(hasNasty(s[field]), field).toBe(false);
    }
    expect(hasNasty(s.worlds.mars)).toBe(false);
    expect(starsFor(s, 'mars')).toBe(1);
    expect(({} as Record<string, unknown>).missionDone).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // And merging them back never brings them in either.
    const merged = merge(s, migrate(JSON.parse(text)));
    expect(hasNasty(merged) || hasNasty(merged.worlds)).toBe(false);
  });

  it('drops odd world names, as v1 did', () => {
    const s = migrate(JSON.parse('{"worlds":{"Mars!":{"missionDone":true},"has space":{"missionDone":true},"MARS":{"missionDone":true}}}'));
    expect(Object.keys(s.worlds)).toEqual([]);
  });

  it('merge does not let a key called __proto__ through, even from a save built in code', () => {
    const a = save({});
    const b = save({});
    Object.defineProperty(b.worlds, '__proto__', { value: { missionDone: true, quizDone: false, perfectQuiz: false }, enumerable: true });
    const m = merge(a, b);
    expect(Object.hasOwn(m.worlds, '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).missionDone).toBeUndefined();
  });
});

describe('fields from a newer version', () => {
  it('survive loading and saving, at the top level and inside every entry', () => {
    const roundTrip = migrate(JSON.parse(JSON.stringify(migrate(JSON.parse(JSON.stringify(V3_FROM_THE_FUTURE))))));
    expect(roundTrip.pets).toEqual({ comet: { name: 'Zip' } });
    expect(roundTrip.theme).toBe('night');
    expect(roundTrip.worlds.mars.rings).toBe(2);
    expect(roundTrip.quizzes.mars.tries).toEqual([1, 2]);
    expect(roundTrip.courses['ring-run'].ghost).toBe('abc');
    expect(roundTrip.courses['ring-run'].bestMs).toBe(39_000);
    expect(roundTrip.version).toBe(2); // this code writes what it knows; the newer fields ride along
  });

  it('survive a merge, from either side', () => {
    const future = migrate(V3_FROM_THE_FUTURE);
    const mine = migrate(V1_EARTH_MISSION);
    for (const m of [merge(future, mine), merge(mine, future)]) {
      expect(m.pets).toEqual({ comet: { name: 'Zip' } });
      expect(m.worlds.mars.rings).toBe(2);
      expect(m.courses['ring-run'].ghost).toBe('abc');
      expect(starsFor(m, 'earth')).toBe(1);
    }
  });
});

describe('merge rules', () => {
  /** Runs a merge both ways round and checks they agree. */
  const both = (a: SaveData, b: SaveData) => {
    const ab = merge(a, b);
    expect(sameSave(ab, merge(b, a))).toBe(true);
    return ab;
  };

  it('flags: OR', () => {
    const a = save({ worlds: { mars: { missionDone: true, quizDone: false, perfectQuiz: false } }, quizzes: { mars: { done: false, perfect: true } } });
    const b = save({ worlds: { mars: { missionDone: false, quizDone: true, perfectQuiz: false } }, quizzes: { mars: { done: true, perfect: false } } });
    const m = both(a, b);
    expect(m.worlds.mars).toEqual({ missionDone: true, quizDone: true, perfectQuiz: false });
    expect(m.quizzes.mars).toEqual({ done: true, perfect: true });
  });

  it('lists: a sorted set union', () => {
    const m = both(save({ dots: ['mars:sky', 'earth:air'], visited: ['mars'] }), save({ dots: ['earth:air', 'a:first'], rescues: ['probe'] }));
    expect(m.dots).toEqual(['a:first', 'earth:air', 'mars:sky']);
    expect(m.visited).toEqual(['mars']);
    expect(m.rescues).toEqual(['probe']);
  });

  it('best times: the lowest, and a time in only one copy is kept', () => {
    const run = (bestMs?: number) => ({ finish: true, crystals: false, smooth: false, ...(bestMs === undefined ? {} : { bestMs }) });
    expect(both(save({ courses: { r: run(40_000) } }), save({ courses: { r: run(38_500) } })).courses.r.bestMs).toBe(38_500);
    expect(both(save({ courses: { r: run(40_000) } }), save({ courses: { r: run() } })).courses.r.bestMs).toBe(40_000);
    expect(both(save({ courses: { r: run() } }), save({ courses: { r: run() } })).courses.r).not.toHaveProperty('bestMs');
  });

  it('repeats: the larger count', () => {
    expect(both(save({ repeats: { q: 3, only: 1 } }), save({ repeats: { q: 5 } })).repeats).toEqual({ q: 5, only: 1 });
  });

  it('patch dates: the earliest', () => {
    const m = both(save({ patchDates: { p: '2026-11-03', a: '2026-01-01' } }), save({ patchDates: { p: '2026-10-30' } }));
    expect(m.patchDates).toEqual({ p: '2026-10-30', a: '2026-01-01' });
  });

  it('choices: the newest `at` wins, and a tie is settled the same way whichever copy comes first', () => {
    const m = both(
      save({ equipped: { trim: { item: 'stripes', at: 10 } }, pilot: { callSign: { value: 'Comet', at: 20 } } }),
      save({ equipped: { trim: { item: 'stars', at: 15 } }, pilot: { callSign: { value: 'Zoom', at: 5 } } }),
    );
    expect(m.equipped.trim).toEqual({ item: 'stars', at: 15 });
    expect(m.pilot.callSign).toEqual({ value: 'Comet', at: 20 });
    const tie = both(save({ equipped: { trim: { item: 'a', at: 7 } } }), save({ equipped: { trim: { item: 'b', at: 7 } } }));
    expect(tie.equipped.trim.at).toBe(7);
  });

  it('unknown fields: kept from either copy, and the first copy wins when both have one', () => {
    const a = save({ theme: 'night', worlds: { mars: { missionDone: true, quizDone: false, perfectQuiz: false, rings: 1 } } });
    const b = save({ theme: 'day', pets: 2, worlds: { mars: { missionDone: false, quizDone: false, perfectQuiz: false, rings: 9, moons: 2 } } });
    const m = merge(a, b);
    expect(m.theme).toBe('night');
    expect(m.pets).toBe(2);
    expect(m.worlds.mars).toEqual({ missionDone: true, quizDone: false, perfectQuiz: false, rings: 1, moons: 2 });
    expect(merge(b, a).theme).toBe('day');
  });

  it('does not change what it was given', () => {
    const a = migrate(V2_FULL);
    const b = migrate(V3_FROM_THE_FUTURE);
    const snapshot = JSON.stringify([a, b]);
    merge(a, b);
    merge(b, a);
    expect(JSON.stringify([a, b])).toBe(snapshot);
  });

  it('merging with an empty save changes nothing', () => {
    const full = migrate(V2_FULL);
    expect(merge(full, emptySave())).toEqual(full);
    expect(merge(emptySave(), full)).toEqual(full);
  });
});

describe('what is saved', () => {
  it('the schema holds exactly the fields of architecture 4.5, and no stars, XP or balance', () => {
    expect(Object.keys(SAVE_SCHEMA).sort()).toEqual(
      ['activities', 'capsules', 'courses', 'dots', 'equipped', 'patchDates', 'pilot', 'quizzes', 'repeats', 'rescues', 'visited', 'worlds'],
    );
    for (const k of Object.keys(emptySave())) expect(k).not.toMatch(/star|xp|balance|coin|credit/i);
  });
});

describe('merge, on many random saves', () => {
  // A small seeded random number generator, so "random" saves are the same on every run.
  function seeded(seed: number) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = seeded(29);
  const coin = () => rand() < 0.5;
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const some = <T>(xs: readonly T[]) => xs.filter(() => rand() < 0.4);
  const IDS = ['mars', 'earth', 'moon', 'venus'] as const;
  const DOT_IDS = ['mars:rim', 'mars:sky', 'earth:air', 'moon:dust', 'venus:cloud'] as const;
  const DATES = ['2026-01-05', '2026-03-01', '2026-11-11', '2025-12-31'] as const;

  /** A random save, built only from known fields, and cleaned up the way a stored one would be. */
  function randomSave(): SaveData {
    const recordOf = <T>(make: () => T) => Object.fromEntries(some(IDS).map((id) => [id, make()]));
    return migrate({
      version: 2,
      worlds: recordOf(() => ({ missionDone: coin(), quizDone: coin(), perfectQuiz: coin() })),
      visited: some(IDS),
      dots: some(DOT_IDS),
      capsules: some(IDS),
      quizzes: recordOf(() => ({ done: coin(), perfect: coin() })),
      courses: recordOf(() => ({ finish: coin(), crystals: coin(), smooth: coin(), ...(coin() ? { bestMs: 30_000 + Math.floor(rand() * 5) * 1000 } : {}) })),
      activities: some(DOT_IDS),
      rescues: some(IDS),
      repeats: recordOf(() => Math.floor(rand() * 4)),
      patchDates: recordOf(() => pick(DATES)),
      equipped: recordOf(() => ({ item: pick(['a', 'b', 'c']), at: Math.floor(rand() * 3) })),
      pilot: coin() ? { callSign: { value: pick(['Comet', 'Zoom']), at: Math.floor(rand() * 3) } } : {},
    });
  }

  /** Everything in `a` that must still be in `m`. */
  function keepsEverything(a: SaveData, m: SaveData) {
    for (const [id, w] of Object.entries(a.worlds)) {
      for (const flag of ['missionDone', 'quizDone', 'perfectQuiz'] as const) if (w[flag]) expect(m.worlds[id][flag]).toBe(true);
    }
    for (const [id, q] of Object.entries(a.quizzes)) for (const flag of ['done', 'perfect'] as const) if (q[flag]) expect(m.quizzes[id][flag]).toBe(true);
    for (const [id, c] of Object.entries(a.courses)) {
      for (const flag of ['finish', 'crystals', 'smooth'] as const) if (c[flag]) expect(m.courses[id][flag]).toBe(true);
      if (c.bestMs !== undefined) expect(m.courses[id].bestMs).toBeLessThanOrEqual(c.bestMs);
    }
    for (const list of ['visited', 'dots', 'capsules', 'activities', 'rescues'] as const) {
      for (const x of a[list]) expect(m[list]).toContain(x);
    }
    for (const [k, n] of Object.entries(a.repeats)) expect(m.repeats[k]).toBeGreaterThanOrEqual(n);
    for (const [k, d] of Object.entries(a.patchDates)) expect(m.patchDates[k] <= d).toBe(true);
    for (const [k, e] of Object.entries(a.equipped)) expect(m.equipped[k].at).toBeGreaterThanOrEqual(e.at);
  }

  it('is the same whichever way round, in any grouping, and merging a save with itself changes nothing', () => {
    for (let i = 0; i < 500; i++) {
      const [a, b, c] = [randomSave(), randomSave(), randomSave()];
      expect(sameSave(merge(a, b), merge(b, a)), `commutative #${i}`).toBe(true);
      expect(sameSave(merge(merge(a, b), c), merge(a, merge(b, c))), `associative #${i}`).toBe(true);
      expect(sameSave(merge(a, a), a), `idempotent #${i}`).toBe(true);
    }
  });

  it('never loses a flag, a list entry or a patch date, and never raises a best time', () => {
    for (let i = 0; i < 500; i++) {
      const [a, b] = [randomSave(), randomSave()];
      const m = merge(a, b);
      keepsEverything(a, m);
      keepsEverything(b, m);
    }
  });
});
