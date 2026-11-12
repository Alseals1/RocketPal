import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { deriveProgression, record, type ProgressionView } from '../src/core/progression';
import { merge } from '../src/core/save/schema';
import { buildContent, type Content } from '../src/data/content';
import { realFiles } from './fixtures/content';
import { DOTS, PLACES, randomSaves } from './fixtures/seeded';

let content: Content;
beforeAll(() => {
  content = buildContent(realFiles());
});

/** Everything in `low` is still there, at least as high, in `high`. */
function neverBelow(low: ProgressionView, high: ProgressionView, label: string) {
  expect(high.xp, label).toBeGreaterThanOrEqual(low.xp);
  expect(high.rank.rank, label).toBeGreaterThanOrEqual(low.rank.rank);
  expect(high.stars.total, label).toBeGreaterThanOrEqual(low.stars.total);
  for (const [place, n] of low.stars.byPlace) expect(high.stars.byPlace.get(place)!, `${label} ${place}`).toBeGreaterThanOrEqual(n);
  for (const [id, m] of low.missions) if (m.done) expect(high.missions.get(id)!.done, `${label} ${id}`).toBe(true);
  for (const [place, page] of low.journal) expect(high.journal.get(place)!.found, `${label} ${place}`).toEqual(expect.arrayContaining(page.found));
}

describe('ranks and stars never go down (acceptance 3)', () => {
  it('for any merge of two random saves (500 pairs)', () => {
    const { save } = randomSaves(3939);
    let rose = 0;
    for (let i = 0; i < 500; i++) {
      const a = save();
      const b = save();
      const m = merge(a, b);
      const [va, vb, vm] = [a, b, m].map((s) => deriveProgression(s, content));
      neverBelow(va, vm, `pair ${i} (a)`);
      neverBelow(vb, vm, `pair ${i} (b)`);
      if (vm.xp > Math.max(va.xp, vb.xp)) rose++;
    }
    expect(rose).toBeGreaterThan(50); // the saves really differ
  });

  it('for any random event recorded on a random save', () => {
    const { save, pick, coin } = randomSaves(16);
    const event = (): GameEvent =>
      pick<() => GameEvent>([
        () => ({ type: 'arrived', place: pick(PLACES) as never }),
        () => ({ type: 'dotFound', dot: pick(DOTS) as never }),
        () => ({ type: 'quizFinished', place: pick(PLACES) as never, firstTryAll: coin() }),
        () => ({ type: 'boost', on: coin() }),
      ])();
    for (let i = 0; i < 500; i++) {
      let s = save();
      for (let j = 0; j < 4; j++) {
        const after = record(s, event(), content);
        neverBelow(deriveProgression(s, content), deriveProgression(after, content), `save ${i} step ${j}`);
        s = after;
      }
    }
  });
});

describe('no randomness in the progression code', () => {
  it('has no Math.random or Date.now', () => {
    const files = ['src/core/events.ts', 'src/core/conditions.ts', ...readdirSync('src/core/progression').map((f) => `src/core/progression/${f}`)];
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/Math\.random|Date\.now/);
  });
});
