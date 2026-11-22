import { beforeAll, describe, expect, it } from 'vitest';
import { deriveProgression } from '../src/core/progression';
import { buildContent, type Content } from '../src/data/content';
import { WORLD_IDS } from '../src/data/ids';
import type { World } from '../src/data/planets';
import {
  REAL_TRACK_FACTOR,
  buildStarMapModel,
  distanceLine,
  evenSpacing,
  nextNodeIndex,
  nodeLabel,
  ordinal,
  realMinGap,
  realSpacing,
} from '../src/ui/starMapModel';
import { realFiles } from './fixtures/content';
import { randomSaves, seeded } from './fixtures/seeded';

let content: Content;
let worlds: World[];
beforeAll(() => {
  content = buildContent(realFiles());
  worlds = [...content.worlds.values()];
});

const model = (overrides: Partial<Parameters<typeof buildStarMapModel>[0]> = {}) =>
  buildStarMapModel({ worlds, stars: new Map(), hereId: null, targetId: null, thumbnail: (id) => `/thumbnails/${id}.webp`, ...overrides });

/** The invariants every real-distance spacing keeps. */
function expectSpacingRules(positions: number[], minGap: number): void {
  expect(positions[0]).toBe(0);
  expect(positions.at(-1)).toBe(1);
  for (let i = 1; i < positions.length; i++) {
    expect(positions[i] - positions[i - 1], `gap ${i}`).toBeGreaterThanOrEqual(minGap - 1e-12);
  }
}

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'],
    [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [111, '111th'],
  ])('%i is %s', (n, word) => {
    expect(ordinal(n)).toBe(word);
  });
});

describe('nodeLabel', () => {
  it('says the name, the place on the track and the stars, the way a screen reader should hear it', () => {
    expect(nodeLabel('Jupiter', 7, 10, 1, false)).toBe('Jupiter, 7th of 10, 1 star of 3');
    expect(nodeLabel('Earth', 4, 10, 0, true)).toBe('Earth, 4th of 10, 0 stars of 3, you are here');
    expect(nodeLabel('Mars', 6, 10, 3, false)).toBe('Mars, 6th of 10, 3 stars of 3');
  });

  it('never says more than 3 stars or fewer than 0', () => {
    expect(nodeLabel('Mars', 6, 10, 7, false)).toBe('Mars, 6th of 10, 3 stars of 3');
    expect(nodeLabel('Mars', 6, 10, -1, false)).toBe('Mars, 6th of 10, 0 stars of 3');
  });
});

describe('spacing', () => {
  it('spaces evenly from 0 to 1', () => {
    expect(evenSpacing(5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(evenSpacing(1)).toEqual([0]);
    expect(evenSpacing(0)).toEqual([]);
  });

  it("with today's worlds: the inner worlds keep the minimum gap, the outer ones their true share of the way", () => {
    const distances = WORLD_IDS.map((id) => content.worlds.get(id)!.distanceFromSunKm);
    const gap = realMinGap(distances.length);
    expect(gap).toBeCloseTo(1 / (REAL_TRACK_FACTOR * 9));
    const real = realSpacing(distances, gap);
    expectSpacingRules(real, gap);
    // Mercury to Jupiter are packed at the minimum gap: their true shares (under 0.18) would overlap.
    for (let i = 1; i <= WORLD_IDS.indexOf('jupiter'); i++) expect(real[i]).toBeCloseTo(i * gap);
    const neptune = content.worlds.get('neptune')!.distanceFromSunKm;
    for (const id of ['saturn', 'uranus'] as const) {
      expect(real[WORLD_IDS.indexOf(id)]).toBeCloseTo(content.worlds.get(id)!.distanceFromSunKm / neptune);
    }
    // The physical gap in real mode (the track is 3 times longer) is never smaller than an even step.
    const evenStep = 1 / (distances.length - 1);
    for (let i = 1; i < real.length; i++) expect((real[i] - real[i - 1]) * REAL_TRACK_FACTOR).toBeGreaterThanOrEqual(evenStep - 1e-12);
  });

  it('keeps the rules for any distances (seeded random)', () => {
    const rand = seeded(42);
    for (let run = 0; run < 300; run++) {
      const count = 2 + Math.floor(rand() * 14);
      const distances = Array.from({ length: count }, () => rand() < 0.2 ? 0 : rand() * 5e9).sort((a, b) => a - b);
      const gap = realMinGap(count);
      const real = realSpacing(distances, gap);
      expect(real).toHaveLength(count);
      if (distances[0] === distances.at(-1)) {
        expect(real).toEqual(evenSpacing(count)); // nothing to spread by
        continue;
      }
      expectSpacingRules(real, gap);
      // Never further out than the minimum gaps need: at most some world's true share plus one gap per world after it.
      const shares = distances.map((d) => (d - distances[0]) / (distances.at(-1)! - distances[0]));
      for (let i = 0; i < count; i++) {
        const bound = Math.max(...shares.slice(0, i + 1).map((share, j) => share + (i - j) * gap));
        expect(real[i]).toBeLessThanOrEqual(Math.min(1, bound) + 1e-12);
      }
    }
  });

  it('gives even spacing when the gaps cannot fit', () => {
    expect(realSpacing([0, 1, 2, 3], 0.5)).toEqual(evenSpacing(4));
  });
});

describe('nextNodeIndex', () => {
  it('moves with the arrows and stops at the ends', () => {
    expect(nextNodeIndex(0, 'ArrowRight', 10)).toBe(1);
    expect(nextNodeIndex(0, 'ArrowDown', 10)).toBe(1);
    expect(nextNodeIndex(5, 'ArrowLeft', 10)).toBe(4);
    expect(nextNodeIndex(5, 'ArrowUp', 10)).toBe(4);
    expect(nextNodeIndex(9, 'ArrowRight', 10)).toBe(9);
    expect(nextNodeIndex(0, 'ArrowLeft', 10)).toBe(0);
  });

  it('goes to the ends with Home and End, and ignores other keys', () => {
    expect(nextNodeIndex(5, 'Home', 10)).toBe(0);
    expect(nextNodeIndex(5, 'End', 10)).toBe(9);
    expect(nextNodeIndex(5, 'Enter', 10)).toBeUndefined();
    expect(nextNodeIndex(0, 'ArrowRight', 0)).toBeUndefined();
  });
});

describe('distanceLine', () => {
  it('says how far each world is from the Sun, and how long light takes', () => {
    expect(distanceLine(content.worlds.get('jupiter')!, worlds)).toBe('778.5 million km from the Sun · light takes 43 minutes');
    expect(distanceLine(content.worlds.get('neptune')!, worlds)).toBe('4.5 billion km from the Sun · light takes 4 hours');
  });

  it('gives the Moon its distance from Earth, and says the Sun is the centre', () => {
    expect(distanceLine(content.worlds.get('moon')!, worlds)).toBe('384,400 km from Earth · light takes 1.3 seconds');
    expect(distanceLine(content.worlds.get('sun')!, worlds)).toBe('The centre of our solar system');
  });
});

describe('buildStarMapModel', () => {
  it('lists all 10 worlds from the Sun outwards, whatever order they come in', () => {
    const nodes = model({ worlds: [...worlds].reverse() }).nodes;
    expect(nodes.map((n) => n.id)).toEqual([...WORLD_IDS]);
    expect(nodes[6].label).toBe('Jupiter, 7th of 10, 0 stars of 3');
  });

  it('shows the stars deriveProgression gives each world, for any save', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const view = deriveProgression(randomSaves(seed).save(), content);
      const nodes = model({ stars: view.stars.byPlace }).nodes;
      for (const node of nodes) expect(node.stars, `${node.id}, seed ${seed}`).toBe(view.stars.byPlace.get(node.id as never) ?? 0);
    }
  });

  it('clamps stars to 0-3', () => {
    const nodes = model({ stars: new Map([['mars', 5], ['earth', -2]]) }).nodes;
    expect(nodes.find((n) => n.id === 'mars')!.stars).toBe(3);
    expect(nodes.find((n) => n.id === 'earth')!.stars).toBe(0);
  });

  it('marks where you are, where you are going and the next step, and says "you are here"', () => {
    const nodes = model({ hereId: 'earth', targetId: 'mars', nextId: 'venus' }).nodes;
    const node = (id: string) => nodes.find((n) => n.id === id)!;
    expect(node('earth')).toMatchObject({ isHere: true, isTarget: false, label: 'Earth, 4th of 10, 0 stars of 3, you are here' });
    expect(node('mars')).toMatchObject({ isHere: false, isTarget: true });
    expect(node('venus').isNext).toBe(true);
    expect(nodes.filter((n) => n.isHere || n.isTarget || n.isNext)).toHaveLength(3);
  });

  it('sizes nodes by kind of world, not to scale', () => {
    const sizes = Object.fromEntries(model().nodes.map((n) => [n.id, n.size]));
    expect(sizes).toMatchObject({ sun: 'sun', mercury: 'small', earth: 'small', moon: 'small', jupiter: 'large', saturn: 'large', uranus: 'large', neptune: 'large' });
  });

  it('carries the thumbnail, hook, colour and both positions', () => {
    const jupiter = model().nodes[6];
    expect(jupiter).toMatchObject({ thumbnail: '/thumbnails/jupiter.webp', color: 'jupiter', hook: content.worlds.get('jupiter')!.hook });
    expect(jupiter.even).toBeCloseTo(6 / 9);
    expect(jupiter.real).toBeCloseTo(6 * realMinGap(10));
  });
});
