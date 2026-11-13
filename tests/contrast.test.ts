/**
 * Every text and background token pair passes WCAG AA in the worst case (docs/VISUAL_DESIGN.md 4.1 and 10).
 *
 * Translucent fills are composited over white and over black (the brightest and darkest thing a panel
 * can sit on), and the lower ratio counts.
 */
import { describe, expect, it } from 'vitest';
import { COLORS, type ColorToken } from '../src/ui/tokens';

type Rgba = { r: number; g: number; b: number; a: number };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(([^)]*)\)$/.exec(colour.replace(/\s+/g, ''));
  if (!rgba) throw new Error(`Cannot read colour ${colour}`);
  const [r, g, b, a = 1] = rgba[1].split(',').map(Number);
  return { r, g, b, a };
}

/** A translucent colour painted over an opaque one. */
function over(top: Rgba, under: Rgba): Rgba {
  const mix = (t: number, u: number) => t * top.a + u * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

/** WCAG 2.x relative luminance. */
function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The worst-case ratio of `fg` on `bg`: a translucent background is tried over white and over black. */
function worstRatio(fg: ColorToken, bg: ColorToken): number {
  const text = parse(COLORS[fg]);
  const back = parse(COLORS[bg]);
  if (back.a === 1) return ratio(text, back);
  return Math.min(ratio(text, over(back, WHITE)), ratio(text, over(back, BLACK)));
}

const TEXT_ON_PANELS: ColorToken[] = ['textPrimary', 'textSoft', 'signalGold', 'holoCyan', 'doneMint', 'starGold'];
const PANELS: ColorToken[] = ['glassFill', 'glassFillStrong', 'space800', 'space700'];
const ACCENTS: ColorToken[] = ['signalGold', 'holoCyan', 'doneMint', 'starGold'];

describe('text contrast (4.5:1 or more)', () => {
  for (const fg of TEXT_ON_PANELS) {
    for (const bg of PANELS) {
      it(`${fg} on ${bg}`, () => {
        expect(worstRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const bg of ACCENTS) {
    it(`textOnAccent on ${bg}`, () => {
      expect(worstRatio('textOnAccent', bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('non-text contrast (3:1 or more)', () => {
  it('retryCoral (crosses and edges) on glassFill', () => {
    expect(worstRatio('retryCoral', 'glassFill')).toBeGreaterThanOrEqual(3);
  });
  it('textPrimary icons on glassFillLight', () => {
    expect(worstRatio('textPrimary', 'glassFillLight')).toBeGreaterThanOrEqual(3);
  });
  it('the holoCyan focus ring on its space950 gap', () => {
    expect(worstRatio('holoCyan', 'space950')).toBeGreaterThanOrEqual(3);
  });
});

describe('dialog titles in the world colour (large text, 3:1 or more)', () => {
  const worlds = (Object.keys(COLORS) as ColorToken[]).filter((k) => k.startsWith('world'));
  it('covers all eleven worlds', () => expect(worlds.length).toBe(11));
  for (const world of worlds) {
    it(`${world} on glassFillStrong`, () => {
      expect(worstRatio(world, 'glassFillStrong')).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('the section 4.1 table', () => {
  const overWhite = (fg: ColorToken, bg: ColorToken) => ratio(parse(COLORS[fg]), over(parse(COLORS[bg]), WHITE));
  const cases: [ColorToken, ColorToken, number][] = [
    ['textPrimary', 'glassFill', 8.4],
    ['signalGold', 'glassFill', 5.8],
    ['holoCyan', 'glassFill', 5.5],
    ['textSoft', 'glassFill', 5.6],
  ];
  for (const [fg, bg, expected] of cases) {
    it(`${fg} on ${bg} over white is ${expected}:1`, () => {
      expect(Math.abs(overWhite(fg, bg) - expected)).toBeLessThanOrEqual(0.1);
    });
  }
  it('navy text is 12.1:1 on gold and 11.3:1 on cyan', () => {
    expect(Math.abs(worstRatio('textOnAccent', 'signalGold') - 12.1)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(worstRatio('textOnAccent', 'holoCyan') - 11.3)).toBeLessThanOrEqual(0.1);
  });
  it('white text on the 0.55 light glass fails as text (why icons only go there)', () => {
    expect(overWhite('textPrimary', 'glassFillLight')).toBeLessThan(4.5);
  });
  it('retryCoral is under 4.5:1 on glass over white, so it is never text', () => {
    expect(overWhite('retryCoral', 'glassFill')).toBeLessThan(4.5);
  });
});
