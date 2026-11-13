/**
 * Stylesheets use tokens only, and the fonts are self-hosted and small.
 * docs/VISUAL_DESIGN.md sections 4 and 4.2.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = 'src/ui/styles/tokens.css';
const FONTS_DIR = path.join(ROOT, 'public/fonts');
const FONT_BUDGET_BYTES = 100_000;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith('.css') ? [full] : [];
  });
}

/** `[property, value]` for every declaration in a stylesheet, comments removed. */
function declarations(css: string): [string, string][] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...clean.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/gi)].map((m) => [m[1].toLowerCase(), m[2].trim()]);
}

const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;

describe('stylesheets', () => {
  const files = cssFiles(path.join(ROOT, 'src')).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));

  it('finds the stylesheets', () => {
    expect(files).toContain('src/style.css');
    expect(files).toContain(TOKENS);
  });

  it('have no colour literal outside tokens.css', () => {
    const found: string[] = [];
    for (const file of files.filter((f) => f !== TOKENS)) {
      for (const [prop, value] of declarations(readFileSync(path.join(ROOT, file), 'utf8'))) {
        if (COLOUR_LITERAL.test(value)) found.push(`${file}: ${prop}: ${value}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('name fonts only through var(--font-*) outside tokens.css', () => {
    const found: string[] = [];
    for (const file of files.filter((f) => f !== TOKENS)) {
      for (const [prop, value] of declarations(readFileSync(path.join(ROOT, file), 'utf8'))) {
        if (prop === 'font-family' && !/^var\(--font-[a-z]+\)$/.test(value)) found.push(`${file}: ${value}`);
        if (prop === 'font' && /['"]/.test(value)) found.push(`${file}: font: ${value}`);
      }
    }
    expect(found).toEqual([]);
  });

  it('can tell a colour literal from a token (self-test)', () => {
    expect(COLOUR_LITERAL.test('#fff')).toBe(true);
    expect(COLOUR_LITERAL.test('0 4px 0 rgba(0, 0, 0, 0.35)')).toBe(true);
    expect(COLOUR_LITERAL.test('hsl(0 0% 0%)')).toBe(true);
    expect(COLOUR_LITERAL.test('var(--legacy-card-shadow)')).toBe(false);
    expect(declarations('#app { color: red; }\n.a:hover { background: #000; }')).toEqual([
      ['color', 'red'],
      ['background', '#000'],
    ]);
  });
});

describe('fonts', () => {
  const tokensCss = readFileSync(path.join(ROOT, TOKENS), 'utf8');
  const urls = [...tokensCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  const woff2 = readdirSync(FONTS_DIR).filter((f) => f.endsWith('.woff2'));

  it('every @font-face file is in public/fonts', () => {
    expect(urls.length).toBe(2);
    for (const url of urls) {
      expect(url).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/);
      expect(existsSync(path.join(ROOT, 'public', url)), url).toBe(true);
    }
  });

  it('use font-display: swap', () => {
    const faces = tokensCss.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.length).toBe(2);
    for (const face of faces) expect(face).toContain('font-display: swap;');
  });

  it(`weigh under ${FONT_BUDGET_BYTES.toLocaleString('en')} bytes in total`, () => {
    const total = woff2.reduce((sum, f) => sum + statSync(path.join(FONTS_DIR, f)).size, 0);
    expect(woff2.length).toBe(2);
    expect(total).toBeLessThan(FONT_BUDGET_BYTES);
  });

  it('each font has its OFL licence beside it', () => {
    for (const file of woff2) {
      const family = file.split('-')[0];
      const licence = path.join(FONTS_DIR, `OFL-${family[0].toUpperCase()}${family.slice(1)}.txt`);
      expect(existsSync(licence), licence).toBe(true);
      expect(readFileSync(licence, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });
});
