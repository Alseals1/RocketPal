import { describe, expect, it } from 'vitest';
import progressionJson from '../public/data/progression.json';
import { FALLBACK_RULES, XP_SOURCES, validateProgression } from '../src/data/progression';

const real = () => structuredClone(progressionJson) as any;

describe('public/data/progression.json', () => {
  it('is valid', () => {
    expect(validateProgression(real())).toEqual([]);
  });

  it('has the 8 ranks of GAME_DESIGN.md section 3', () => {
    expect(real().ranks.map((r: any) => [r.rank, r.name, r.xp])).toEqual([
      [1, 'Cadet', 0],
      [2, 'Junior Pilot', 60],
      [3, 'Pilot', 160],
      [4, 'Navigator', 300],
      [5, 'Explorer', 480],
      [6, 'Senior Explorer', 700],
      [7, 'Commander', 960],
      [8, 'Star Captain', 1260],
    ]);
  });

  it('has the XP table of GAME_DESIGN.md section 10, with one value for the ranges', () => {
    expect(real().xp).toEqual({
      dot: { first: 5, again: 1 },
      capsule: { first: 3, again: 1 },
      mission: { first: 20, again: 5 },
      quiz: { first: 20, again: 5 },
      perfectQuiz: { first: 10, again: 0 },
      course: { first: 30, again: 5 },
      courseStar: { first: 10, again: 0 },
      personalBest: { first: 0, again: 5 },
      sideMission: { first: 20, again: 0 }, // 15-25 in the design
      chapter: { first: 50, again: 0 },
      activity: { first: 10, again: 2 }, // 10-15 in the design
    });
    expect(real().repeatCap).toBe(10);
  });
});

describe('validateProgression', () => {
  it('rejects data that is not an object', () => {
    expect(validateProgression(null)).toEqual(['progression data must be an object']);
    expect(validateProgression([])).toEqual(['progression data must be an object']);
  });

  it('needs every XP source with whole numbers of 0 or more', () => {
    const missing = real();
    delete missing.xp.capsule;
    expect(validateProgression(missing)).toEqual(['xp.capsule must have "first" and "again", each a whole number of 0 or more']);
    const negative = real();
    negative.xp.dot.again = -1;
    expect(validateProgression(negative)).toEqual(['xp.dot must have "first" and "again", each a whole number of 0 or more']);
    const fraction = real();
    fraction.xp.quiz.first = 2.5;
    expect(validateProgression(fraction)).toHaveLength(1);
    const noTable = real();
    noTable.xp = [];
    expect(validateProgression(noTable)).toEqual(['xp must be an object with an entry for each XP source']);
  });

  it('needs a repeatCap', () => {
    const bad = real();
    bad.repeatCap = 'ten';
    expect(validateProgression(bad)).toEqual(['repeatCap must be a whole number of 0 or more']);
  });

  it('needs at least one rank', () => {
    const bad = real();
    bad.ranks = [];
    expect(validateProgression(bad)).toEqual(['ranks must be a list of at least one rank']);
  });

  it('needs ranks numbered 1, 2, 3... in order', () => {
    const bad = real();
    [bad.ranks[1], bad.ranks[2]] = [bad.ranks[2], bad.ranks[1]];
    expect(validateProgression(bad)).toContain('ranks[1]: rank must be 2 (ranks are numbered 1, 2, 3... in order)');
  });

  it('needs the first rank at 0 xp and each later rank above the one before', () => {
    const first = real();
    first.ranks[0].xp = 5;
    expect(validateProgression(first)).toEqual(['ranks[0]: the first rank starts at 0 xp']);
    const flat = real();
    flat.ranks[3].xp = flat.ranks[2].xp;
    expect(validateProgression(flat)).toEqual(['ranks[3]: xp must be more than the rank before']);
    const notNumber = real();
    notNumber.ranks[3].xp = '300';
    expect(validateProgression(notNumber)).toEqual(['ranks[3]: xp must be a whole number of 0 or more']);
  });

  it('needs a short rank name', () => {
    const empty = real();
    empty.ranks[2].name = ' ';
    expect(validateProgression(empty)).toEqual(['ranks[2]: name is required and at most 20 characters']);
    const long = real();
    long.ranks[2].name = 'A very very long rank name';
    expect(validateProgression(long)).toEqual(['ranks[2]: name is required and at most 20 characters']);
  });
});

describe('FALLBACK_RULES', () => {
  it('is valid, gives no XP and has one rank', () => {
    expect(validateProgression(FALLBACK_RULES)).toEqual([]);
    for (const s of XP_SOURCES) expect(FALLBACK_RULES.xp[s]).toEqual({ first: 0, again: 0 });
    expect(FALLBACK_RULES.repeatCap).toBe(0);
    expect(FALLBACK_RULES.ranks).toEqual([{ rank: 1, name: 'Cadet', xp: 0 }]);
  });
});
