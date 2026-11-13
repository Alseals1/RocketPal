/**
 * Design tokens: tokens.css holds every section 4 token, and its colours match src/ui/tokens.ts.
 * docs/VISUAL_DESIGN.md section 4.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, COLORS, hexToNumber } from '../src/ui/tokens';

const CSS = readFileSync(new URL('../src/ui/styles/tokens.css', import.meta.url), 'utf8');

/** The custom properties of the first `:root { ... }` block (the defaults), comments removed. */
function rootTokens(css: string): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = clean.indexOf(':root {');
  const body = clean.slice(start + ':root {'.length, clean.indexOf('\n}', start));
  const tokens = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());
  return tokens;
}

/** `space950` -> `--space-950`, `glassFillStrong` -> `--glass-fill-strong`. */
const cssName = (key: string) => '--' + key.replace(/([a-z])([A-Z]|\d+)/g, '$1-$2').toLowerCase();

/** One spelling per colour: lower case, no spaces, `#fff` -> `#ffffff`. */
function normalise(value: string): string {
  const v = value.toLowerCase().replace(/\s+/g, '');
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : v;
}

const isColour = (value: string) => /^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(value.trim());

const tokens = rootTokens(CSS);

/** Every token docs/VISUAL_DESIGN.md section 4 names, plus the font and layer tokens the plan adds. */
const SECTION_4 = [
  // 4.1
  '--space-950', '--space-900', '--space-800', '--space-700', '--nebula-violet', '--nebula-teal',
  '--glass-fill', '--glass-fill-strong', '--glass-fill-light', '--glass-edge', '--glass-highlight', '--glass-blur', '--scrim',
  '--text-primary', '--text-soft', '--text-on-accent',
  '--signal-gold', '--signal-gold-deep', '--holo-cyan', '--holo-violet', '--done-mint', '--retry-coral', '--star-gold',
  '--world-sun', '--world-mercury', '--world-venus', '--world-earth', '--world-moon', '--world-mars', '--world-belt',
  '--world-jupiter', '--world-saturn', '--world-uranus', '--world-neptune',
  // 4.2
  '--font-display', '--font-text',
  '--type-display', '--type-title', '--type-heading', '--type-body', '--type-ui', '--type-label', '--type-numeral',
  // 4.3
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-7', '--gutter',
  '--radius-chip', '--radius-card', '--radius-sheet', '--radius-pill',
  '--target-min', '--target-main',
  '--shadow-panel', '--glow-gold', '--glow-cyan',
  '--layer-canvas', '--layer-tags', '--layer-hud', '--layer-touch', '--layer-sheet', '--layer-dialog', '--layer-toast',
  // 4.4
  '--dur-press', '--dur-quick', '--dur-panel', '--dur-screen', '--dur-celebrate', '--ease-out', '--ease-in-out', '--ease-spring',
];

describe('tokens.css', () => {
  it('defines every section 4 token', () => {
    const missing = SECTION_4.filter((name) => !tokens.has(name));
    expect(missing).toEqual([]);
  });

  it('has the section 4 values for the key tokens', () => {
    expect(normalise(tokens.get('--glass-fill')!)).toBe('rgba(11,16,48,0.75)');
    expect(normalise(tokens.get('--signal-gold')!)).toBe('#ffd166');
    expect(tokens.get('--target-min')).toBe('56px');
    expect(tokens.get('--target-main')).toBe('64px');
    expect(tokens.get('--glass-blur')).toBe('16px');
    expect(tokens.get('--dur-panel')).toBe('320ms');
    expect(tokens.get('--layer-toast')).toBe('60');
  });

  it('multiplies every type size by --ui-scale', () => {
    const sizes = [...tokens].filter(([name]) => name.startsWith('--type-'));
    expect(sizes.length).toBe(7);
    for (const [name, value] of sizes) expect(value, name).toMatch(/^calc\(\d+px \* var\(--ui-scale\)\)$/);
  });

  it('names the self-hosted fonts first', () => {
    expect(tokens.get('--font-display')).toMatch(/^'Fredoka',/);
    expect(tokens.get('--font-text')).toMatch(/^'Lexend',/);
  });

  it('turns blur off on low quality and durations to 0 with reduced motion', () => {
    expect(CSS).toMatch(/:root\[data-quality='low'\]\s*\{\s*--glass-blur:\s*0px;/);
    const reduced = /:root\[data-reduced-motion='true'\]\s*\{([^}]*)\}/.exec(CSS)![1];
    for (const name of ['--dur-press', '--dur-quick', '--dur-panel', '--dur-screen', '--dur-celebrate']) {
      expect(reduced).toContain(`${name}: 0ms;`);
    }
  });
});

describe('tokens.css and tokens.ts agree', () => {
  const cssColours = new Map([...tokens].filter(([, value]) => isColour(value)));

  it('every colour in tokens.ts is in tokens.css with the same value', () => {
    for (const [key, value] of Object.entries(COLORS)) {
      const name = cssName(key);
      expect(cssColours.has(name), `${name} missing from tokens.css`).toBe(true);
      expect(normalise(cssColours.get(name)!), name).toBe(normalise(value));
    }
  });

  it('every colour in tokens.css is in tokens.ts', () => {
    const tsNames = new Set(Object.keys(COLORS).map(cssName));
    const missing = [...cssColours.keys()].filter((name) => !tsNames.has(name));
    expect(missing).toEqual([]);
  });
});

describe('tokens.ts', () => {
  it('turns hex into the number Three.js takes', () => {
    expect(hexToNumber('#03040c')).toBe(0x03040c);
    expect(hexToNumber('#FFF')).toBe(0xffffff);
    expect(hexToNumber(COLORS.signalGold)).toBe(0xffd166);
    expect(() => hexToNumber('rgba(0, 0, 0, 1)')).toThrow();
  });

  it('has the section 4.5 breakpoints', () => {
    expect(BREAKPOINTS).toEqual({ compactMaxWidth: 599, shortMaxHeight: 519, mediumMinWidth: 600, wideMinWidth: 1200 });
  });
});
