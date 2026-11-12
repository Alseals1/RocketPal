import { beforeAll, describe, expect, it } from 'vitest';
import { createProgressionMemo, deriveProgression, rankFor, record } from '../src/core/progression';
import { emptySave, migrate, type SaveData } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import { realFiles } from './fixtures/content';
import { emptyProgressV1, loadProgressV1, oldTabEarnsMission, saveProgressV1, type ProgressV1 } from './fixtures/progressV1';
import { NO_VERSION, V1_EARTH_MISSION, V1_MARS_3_EARTH_2, V2_FULL, V3_FROM_THE_FUTURE } from './fixtures/saves';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

const save = (fields: Record<string, unknown>): SaveData => migrate({ version: 2, ...fields });

/** The v1 star formula, written out here (never imported), so the derived stars are checked against the old rule. */
const v1Stars = (raw: { worlds?: Record<string, { missionDone?: boolean; quizDone?: boolean; perfectQuiz?: boolean }> }, place: string) => {
  const w = raw.worlds && Object.hasOwn(raw.worlds, place) ? raw.worlds[place] : undefined;
  return Number(w?.missionDone === true) + Number(w?.quizDone === true) + Number(w?.perfectQuiz === true);
};

/** A record written by the frozen v1 save code: Mars mission, then Earth mission, through a storage. */
function writtenByV1(): ProgressV1 {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  let memory = emptyProgressV1();
  memory = oldTabEarnsMission(storage as never, memory, 'mars');
  saveProgressV1(oldTabEarnsMission(storage as never, memory, 'earth'), storage as never);
  return JSON.parse(store.get('rocketpals.progress')!) as ProgressV1 & { version: number };
}

const ALL_DOTS = () => [...content.arrivals].flatMap(([place, a]) => a.hotspots.map((h) => `${place}/${h.id}`));

describe('v1 saves keep their stars and missions (acceptance 1)', () => {
  const fixtures: [string, () => object][] = [
    ['V1_EARTH_MISSION', () => V1_EARTH_MISSION],
    ['V1_MARS_3_EARTH_2', () => V1_MARS_3_EARTH_2],
    ['NO_VERSION', () => NO_VERSION],
    ['written by the v1 code', writtenByV1],
  ];
  for (const [name, raw] of fixtures) {
    it(name, () => {
      const r = raw() as { worlds: Record<string, { missionDone: boolean }> };
      const view = deriveProgression(migrate(structuredClone(r)), content);
      for (const place of content.places.keys()) expect(view.stars.byPlace.get(place), place).toBe(v1Stars(r, place));
      for (const place of ['earth', 'mars']) {
        expect(view.missions.get(`find-3-${place}`)!.done, place).toBe(r.worlds[place]?.missionDone === true);
      }
    });
  }

  it('the frozen v1 code really wrote both missions', () => {
    const r = writtenByV1();
    expect(Object.keys(r.worlds).sort()).toEqual(['earth', 'mars']);
    expect(loadProgressV1(null)).toEqual(emptyProgressV1());
  });

  it('v2 and v3 saves never have fewer stars than the v1 formula', () => {
    for (const raw of [V2_FULL, V3_FROM_THE_FUTURE]) {
      const view = deriveProgression(migrate(structuredClone(raw)), content);
      for (const place of content.places.keys()) expect(view.stars.byPlace.get(place)!).toBeGreaterThanOrEqual(v1Stars(raw, place));
    }
  });
});

describe('XP for the content that exists (acceptance 2)', () => {
  /** Every dot found, both find missions, both quizzes perfect on the first try. */
  function playEverythingOnce(): SaveData {
    let s = emptySave();
    for (const place of content.places.keys()) s = record(s, { type: 'arrived', place }, content);
    for (const d of ALL_DOTS()) s = record(s, { type: 'dotFound', dot: d as never }, content);
    for (const place of content.quizzes.keys()) s = record(s, { type: 'quizFinished', place, firstTryAll: true }, content);
    return s;
  }

  it('playing everything once is 155 XP: 11 x 5 + 2 x 20 + 2 x 20 + 2 x 10, rank 2', () => {
    expect(ALL_DOTS()).toHaveLength(11);
    const view = deriveProgression(playEverythingOnce(), content);
    expect(view.xp).toBe(11 * 5 + 2 * 20 + 2 * 20 + 2 * 10);
    expect(view.xp).toBe(155);
    expect(view.rank).toEqual({ rank: 2, name: 'Junior Pilot', xpIntoRank: 95, xpForNext: 5 });
    expect(view.stars.total).toBe(6);
    expect([...view.missions.values()].every((m) => m.done)).toBe(true);
  });

  it('replays add their "again" XP, capped: 10 x 1 + 3 x 5 = 25 more, 180 XP, rank 3', () => {
    const s = { ...playEverythingOnce(), repeats: { 'dot:mars/rim': 12, 'quiz:mars': 3 } };
    const view = deriveProgression(s, content);
    expect(view.xp).toBe(180);
    expect(view.rank).toEqual({ rank: 3, name: 'Pilot', xpIntoRank: 20, xpForNext: 120 });
  });

  it('replays of things the content does not have give nothing', () => {
    const s = save({ repeats: { 'dot:mars/nothing': 5, 'quiz:venus': 5, 'mission:find-3-mars': 5, 'course:cadet': 5 } });
    expect(deriveProgression(s, content).xp).toBe(0);
  });

  it('a v1 save earns XP for what its flags say', () => {
    const view = deriveProgression(migrate(structuredClone(V1_MARS_3_EARTH_2)), content);
    expect(view.xp).toBe(2 * 20 + 2 * 20 + 10); // two missions, two quizzes, one perfect
  });

  it('with the fallback rules nothing gives XP, but stars and missions still work', () => {
    const noRules = buildContent({ ...realFiles(), progression: undefined });
    const view = deriveProgression(playEverythingOnce(), noRules);
    expect(view.xp).toBe(0);
    expect(view.rank).toEqual({ rank: 1, name: 'Cadet', xpIntoRank: 0, xpForNext: null });
    expect(view.stars.total).toBe(6);
  });
});

describe('rankFor', () => {
  it('moves up exactly at each rank\'s XP', () => {
    const rules = content.progression;
    expect(rankFor(0, rules)).toEqual({ rank: 1, name: 'Cadet', xpIntoRank: 0, xpForNext: 60 });
    expect(rankFor(59, rules)).toMatchObject({ rank: 1, xpForNext: 1 });
    expect(rankFor(60, rules)).toEqual({ rank: 2, name: 'Junior Pilot', xpIntoRank: 0, xpForNext: 100 });
    expect(rankFor(1259, rules)).toMatchObject({ rank: 7, name: 'Commander', xpForNext: 1 });
    expect(rankFor(1260, rules)).toEqual({ rank: 8, name: 'Star Captain', xpIntoRank: 0, xpForNext: null });
    expect(rankFor(5000, rules)).toEqual({ rank: 8, name: 'Star Captain', xpIntoRank: 3740, xpForNext: null });
  });
});

describe('deriveProgression shapes (D8)', () => {
  it('has stars for every place, 0 included, and nothing for content that does not exist yet', () => {
    const view = deriveProgression(emptySave(), content);
    expect([...view.stars.byPlace.keys()]).toEqual([...content.places.keys()]);
    expect([...view.stars.byPlace.values()].every((n) => n === 0)).toBe(true);
    expect(view.stars.total).toBe(0);
    expect(view.stars.byCourse.size).toBe(0);
    expect(view.chapters.size).toBe(0);
    expect(view.patches.size).toBe(0);
    expect(view.unlocked.size).toBe(0);
  });

  it('has a mission entry for each mission, with its progress', () => {
    const view = deriveProgression(save({ dots: ['mars/rim', 'mars/sky'] }), content);
    expect([...view.missions.keys()]).toEqual(['find-3-mars', 'find-3-earth']);
    expect(view.missions.get('find-3-mars')).toEqual({ done: false, progress: { done: 2, of: 3 } });
    expect(view.missions.get('find-3-earth')).toEqual({ done: false, progress: { done: 0, of: 3 } });
  });

  it('has a Journal page list for each place with a picture: found dots in picture order, and the total', () => {
    const view = deriveProgression(save({ dots: ['mars/sky', 'mars/rim', 'mars/x', 'earth/about'] }), content);
    expect([...view.journal.keys()]).toEqual([...content.arrivals.keys()]);
    expect(view.journal.get('mars')).toEqual({ found: ['mars/rim', 'mars/sky'], total: 5 });
    expect(view.journal.get('earth')).toEqual({ found: ['earth/about'], total: 6 });
  });
});

describe('createProgressionMemo', () => {
  it('works it out once per revision and gives back the same object', () => {
    const memo = createProgressionMemo(content);
    const s = save({ dots: ['mars/rim'] });
    const a = memo(s, 1);
    expect(memo(s, 1)).toBe(a);
    expect(memo(save({ dots: [] }), 1)).toBe(a); // the revision, not the save, decides
    const b = memo(save({ dots: ['mars/rim', 'mars/sky'] }), 2);
    expect(b).not.toBe(a);
    expect(b.journal.get('mars')!.found).toHaveLength(2);
  });
});

describe('speed', () => {
  it('derives a full save in well under 50 ms', () => {
    const full = save({
      ...structuredClone(V2_FULL),
      dots: ALL_DOTS(),
      visited: [...content.places.keys()],
      quizzes: { mars: { done: true, perfect: true }, earth: { done: true, perfect: false } },
      repeats: { 'dot:mars/rim': 10, 'quiz:mars': 10, 'quiz:earth': 3 },
    });
    deriveProgression(full, content); // warm up
    const start = performance.now();
    deriveProgression(full, content);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
