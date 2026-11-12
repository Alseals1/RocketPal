/**
 * Architecture test: keeps game logic, rendering and UI apart.
 *
 * It maps every file under `src/` to a layer from docs/TECHNICAL_ARCHITECTURE.md
 * section 3, reads the file's imports (plain Node, no parser), and fails when a
 * layer imports something it may not. The rules are a closed list: if a layer
 * does not name a thing, it may not import it. How the table was read is in
 * decisions/2026-11-12-architecture-import-rules.md.
 *
 * When this test fails:
 *  - A real break: move the type or the code to the right layer. Do not add an
 *    ALLOWED_BREAKS entry for new code.
 *  - A new folder under src/: add it to LAYERS on purpose.
 *  - A reading of the table you disagree with: change MAY_IMPORT (one line) and
 *    record why in decisions/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Layer = 'Content' | 'Logic' | 'Render' | 'UI' | 'Platform' | 'Screens' | 'App';

/**
 * Path prefix -> layer. The longest matching prefix wins. A prefix that ends in
 * a file extension matches that exact file only. Paths are relative to the repo
 * root, with `/` separators.
 */
const LAYERS: ReadonlyArray<readonly [prefix: string, layer: Layer]> = [
  ['src/data/', 'Content'],
  ['src/core/', 'Logic'],
  ['src/flight/', 'Logic'],
  ['src/quiz/', 'Logic'],
  ['src/scale/', 'Logic'],
  ['src/quality/', 'Logic'],
  ['src/platform/', 'Platform'],
  // Section 2 and the table call these platform code that moves to platform/ over time.
  ['src/audio/', 'Platform'],
  ['src/flight/input.ts', 'Platform'],
  ['src/render/', 'Render'],
  ['src/scene/', 'Render'],
  ['src/surface/', 'Render'],
  ['src/ui/', 'UI'],
  ['src/screens/', 'Screens'],
  ['src/activities/', 'Screens'],
  ['src/app/', 'App'],
  ['src/app.ts', 'App'],
  ['src/main.ts', 'App'],
  ['src/game.ts', 'App'],
  ['src/style.css', 'App'],
];

interface Allowed {
  /** `src/` layers this layer may import ('all' means every layer). */
  layers: readonly Layer[] | 'all';
  /** npm packages this layer may import (a package and its sub-paths). 'all' means any. */
  packages: readonly string[] | 'all';
  /** Single files outside those layers that this layer may also import. */
  files?: readonly string[];
}

/**
 * What each layer may import. Content is open to every layer because section 4
 * keeps the shared types in `data/` ("everything else depends on them").
 */
const MAY_IMPORT: Record<Layer, Allowed> = {
  Content: { layers: ['Content'], packages: [] },
  Logic: { layers: ['Content', 'Logic'], packages: [] },
  Render: { layers: ['Content', 'Logic', 'Render'], packages: ['three'], files: ['src/ui/tokens.ts'] },
  UI: { layers: ['Content', 'Logic', 'UI'], packages: [] },
  Platform: { layers: ['Content', 'Logic', 'Platform'], packages: ['howler'] },
  Screens: { layers: 'all', packages: 'all' },
  App: { layers: 'all', packages: 'all' },
};

/** One-line summary of each layer's row, used in failure messages. */
const RULE_TEXT: Record<Layer, string> = {
  Content: 'Content may import only Content (no packages)',
  Logic: 'Logic may import only Content and Logic (no packages)',
  Render: "Render may import only Content, Logic and Render, 'three', and src/ui/tokens.ts",
  UI: 'UI may import only Content, Logic and UI (no packages)',
  Platform: "Platform may import only Content, Logic and Platform, and 'howler'",
  Screens: 'Screens may import anything',
  App: 'App may import anything',
};

/**
 * Files that break a rule today. Each entry is a (file, target) pair, so a NEW
 * bad import in the same file still fails. This list can only shrink: an entry
 * that no longer matches a real break fails the test ("remove this entry").
 * Do not edit src/ to shrink it in this file's PR; later issues do that.
 */
const ALLOWED_BREAKS: ReadonlyArray<{ file: string; target: string }> = [
  // Content imports Logic. `QuizQuestion` belongs with the question data. It moves
  // to data/ with the question pools (#45, TECHNICAL_ARCHITECTURE.md section 4.10).
  { file: 'src/data/quizzes.ts', target: 'src/quiz/quiz.ts' },
  // Logic imports Render. `BodyLayout` is pure data. Move it out of scene/ into logic
  // or content the next time scene/layout.ts is changed.
  { file: 'src/scale/leg.ts', target: 'src/scene/layout.ts' },
  // UI imports Render. Same `BodyLayout` move. The Star Map rewrite of the HUD (#42)
  // is the natural point.
  { file: 'src/ui/hud.ts', target: 'src/scene/layout.ts' },
  // UI imports Render. `ScreenPoint` is a plain `{ x, y }` view type. Move it to ui/ or logic.
  { file: 'src/ui/hud.ts', target: 'src/scene/spaceScene.ts' },
  // UI imports Render. Same `ScreenPoint` move.
  { file: 'src/ui/surfaceHud.ts', target: 'src/scene/spaceScene.ts' },
  // UI imports Platform. UI should get a "read aloud" callback, or a `Speaker` type from
  // a shared place. Goes with the sound work (`platform/audio.ts`, section 6).
  { file: 'src/ui/quizPanel.ts', target: 'src/audio/speech.ts' },
  // UI imports Platform. Same `Speaker` move.
  { file: 'src/ui/surfaceHud.ts', target: 'src/audio/speech.ts' },
];

// ---------------------------------------------------------------------------
// The checker (pure: it never touches the disk, so the tests can feed it fakes)
// ---------------------------------------------------------------------------

const SEE_DOC = 'See docs/TECHNICAL_ARCHITECTURE.md section 3.';

export function layerOf(file: string): Layer | undefined {
  let best: { length: number; layer: Layer } | undefined;
  for (const [prefix, layer] of LAYERS) {
    const isFile = /\.[a-z]+$/.test(prefix);
    const matches = isFile ? file === prefix : file.startsWith(prefix);
    if (matches && (!best || prefix.length > best.length)) best = { length: prefix.length, layer };
  }
  return best?.layer;
}

/**
 * Replace `//` and `/* *\/` comments with spaces (keeping newlines) and copy
 * string literals unchanged, so commented-out imports are ignored and a
 * `//` inside a string does not hide the real code after it. `inString[i]` is
 * true when character `i` of the result is inside a string literal (quotes
 * included), so text that only looks like an import inside a string can be skipped.
 */
export function scanSource(text: string): { code: string; inString: boolean[] } {
  let code = '';
  const inString: boolean[] = [];
  const push = (chunk: string, string: boolean) => {
    code += chunk;
    for (let k = 0; k < chunk.length; k++) inString.push(string);
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      push(text.slice(i, j + 1), true);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      let j = i;
      while (j < text.length && text[j] !== '\n') j++;
      push(' '.repeat(j - i), false);
      i = j;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      push(text.slice(i, stop).replace(/[^\n]/g, ' '), false);
      i = stop;
    } else {
      push(c, false);
      i++;
    }
  }
  return { code, inString };
}

export interface FoundImport {
  /** The module as written, or null for a dynamic `import()` whose argument is not a string literal. */
  spec: string | null;
}

export function findImports(source: string): FoundImport[] {
  const { code, inString } = scanSource(source);
  const found: FoundImport[] = [];
  const realMatches = (pattern: RegExp) => [...code.matchAll(pattern)].filter((m) => !inString[m.index]);
  // import ... from '...', import type ... from '...', export ... from '...', export * from '...'
  for (const m of realMatches(/\b(?:import|export)\s[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1/g)) found.push({ spec: m[2] });
  // import '...'
  for (const m of realMatches(/\bimport\s*(['"])([^'"]+)\1/g)) found.push({ spec: m[2] });
  // import('...')
  for (const m of realMatches(/\bimport\s*\(\s*([^)]*)\)/g)) {
    const arg = m[1].trim();
    const literal = /^(['"`])([^'"`$]*)\1$/.exec(arg);
    found.push({ spec: literal ? literal[2] : null });
  }
  return found;
}

type Resolved =
  | { kind: 'package'; name: string }
  | { kind: 'file'; path: string }
  | { kind: 'unresolved' };

/** Bundler-style resolution: exact file, `.ts`, `.tsx`, `/index.ts`, and `.js` written for a `.ts` file. */
export function resolveImport(fromFile: string, spec: string, exists: (file: string) => boolean): Resolved {
  if (!spec.startsWith('.')) {
    const parts = spec.split('/');
    return { kind: 'package', name: spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] };
  }
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  if (base.startsWith('..') || !base.startsWith('src/')) return { kind: 'unresolved' };
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
  if (base.endsWith('.js')) candidates.push(`${base.slice(0, -3)}.ts`);
  const hit = candidates.find((candidate) => exists(candidate));
  return hit ? { kind: 'file', path: hit } : { kind: 'unresolved' };
}

export interface Violation {
  file: string;
  /** The import as written (or `import(...)` for a dynamic one that is not a literal). */
  spec: string;
  /** The resolved file, the package name, or the raw spec when it could not be resolved. */
  target: string;
  message: string;
}

export function checkFile(file: string, source: string, exists: (file: string) => boolean): Violation[] {
  const layer = layerOf(file);
  if (!layer) {
    return [
      {
        file,
        spec: '',
        target: '',
        message: `no layer for ${file}: add it to LAYERS in tests/architecture.test.ts. ${SEE_DOC}`,
      },
    ];
  }
  const allowed = MAY_IMPORT[layer];
  const violations: Violation[] = [];
  for (const { spec } of findImports(source)) {
    if (spec === null) {
      violations.push({
        file,
        spec: 'import(...)',
        target: 'import(...)',
        message: `${file} has a dynamic import() with a computed argument (${layer}): the checker cannot see where it goes, so use a string literal. ${SEE_DOC}`,
      });
      continue;
    }
    const resolved = resolveImport(file, spec, exists);
    if (resolved.kind === 'unresolved') {
      violations.push({
        file,
        spec,
        target: spec,
        message: `${file} imports '${spec}' (${layer}): it does not resolve to a file under src/. ${SEE_DOC}`,
      });
    } else if (resolved.kind === 'package') {
      if (allowed.packages !== 'all' && !allowed.packages.includes(resolved.name)) {
        violations.push({
          file,
          spec,
          target: resolved.name,
          message: `${file} imports '${spec}' (package ${resolved.name}, from ${layer}): ${RULE_TEXT[layer]}. ${SEE_DOC}`,
        });
      }
    } else {
      const targetLayer = layerOf(resolved.path);
      const ok =
        allowed.layers === 'all' ||
        (targetLayer !== undefined && allowed.layers.includes(targetLayer)) ||
        (allowed.files?.includes(resolved.path) ?? false);
      if (!ok) {
        violations.push({
          file,
          spec,
          target: resolved.path,
          message: `${file} imports '${spec}' (${resolved.path}, ${targetLayer ?? 'no layer'}): ${RULE_TEXT[layer]}. ${SEE_DOC}`,
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Self-tests: fake files through the same checker
// ---------------------------------------------------------------------------

const FAKE_FILES = new Set([
  'src/core/progress.ts',
  'src/scene/layout.ts',
  'src/scene/spaceScene.ts',
  'src/scene/shipModel.ts',
  'src/ui/tokens.ts',
  'src/ui/hud.ts',
  'src/app.ts',
  'src/app/screens.ts',
  'src/audio/speech.ts',
  'src/data/ids.ts',
  'src/main.ts',
]);
const fakeExists = (file: string) => FAKE_FILES.has(file);
const check = (file: string, source: string) => checkFile(file, source, fakeExists);
const messages = (file: string, source: string) => check(file, source).map((v) => v.message);

describe('import checker (fake files)', () => {
  it('fails logic importing three, naming the file, the import and the rule', () => {
    const [message] = messages('src/core/state.ts', `import * as THREE from 'three';\nvoid THREE;`);
    expect(message).toContain('src/core/state.ts');
    expect(message).toContain("'three'");
    expect(message).toContain('Logic may import only Content and Logic');
    expect(message).toContain('docs/TECHNICAL_ARCHITECTURE.md section 3');
  });

  it('names the resolved target and its layer when a layer is wrong', () => {
    const [message] = messages('src/scale/leg.ts', `import type { BodyLayout } from '../scene/layout';`);
    expect(message).toContain("src/scale/leg.ts imports '../scene/layout' (src/scene/layout.ts, Render)");
  });

  it('catches every import form', () => {
    const forms: Record<string, string> = {
      'import ... from': `import { a } from 'three';`,
      'import type ... from': `import type { A } from 'three';`,
      'import * as': `import * as T from 'three';`,
      'side-effect import': `import 'three';`,
      'export ... from': `export { a } from 'three';`,
      'export type ... from': `export type { A } from 'three';`,
      'export * from': `export * from 'three';`,
      'dynamic import': `const m = await import('three');`,
      'dynamic import with a plain template literal': 'const m = await import(`three`);',
      'multi-line import': `import {\n  a,\n  b,\n} from\n  'three';`,
      'sub-path import': `import { G } from 'three/addons/loaders/GLTFLoader.js';`,
    };
    for (const [name, source] of Object.entries(forms)) {
      expect(check('src/core/x.ts', source), name).toHaveLength(1);
    }
  });

  it('fails a dynamic import whose argument is not a string literal', () => {
    const [message] = messages('src/core/x.ts', `const m = await import(name);`);
    expect(message).toContain('dynamic import()');
    expect(message).toContain('src/core/x.ts');
  });

  it('follows a dynamic import to its layer', () => {
    const [message] = messages('src/core/x.ts', `const m = await import('../scene/shipModel');`);
    expect(message).toContain('(src/scene/shipModel.ts, Render)');
  });

  it('ignores imports in comments, and does not let strings confuse the comment scanner', () => {
    expect(messages('src/core/x.ts', `// import * as T from 'three';\n/* import 'three';\n import 'three'; */\nexport const a = 1;`)).toEqual([]);
    const source = `const url = 'http://x'; const s = "// import x from 'three'";\nimport { ids } from '../data/ids';\nimport * as T from 'three';`;
    const found = findImports(source).map((i) => i.spec);
    expect(found).toContain('three');
    expect(found).toContain('../data/ids');
    expect(check('src/core/x.ts', source)).toHaveLength(1);
  });

  it('lets render import ui/tokens.ts but no other ui file', () => {
    expect(messages('src/scene/x.ts', `import { color } from '../ui/tokens';`)).toEqual([]);
    const [message] = messages('src/scene/x.ts', `import { Hud } from '../ui/hud';`);
    expect(message).toContain('(src/ui/hud.ts, UI)');
    expect(message).toContain('Render may import only');
  });

  it("lets render import 'three' and platform import 'howler', but not the other way round", () => {
    expect(messages('src/scene/x.ts', `import * as T from 'three';`)).toEqual([]);
    expect(messages('src/platform/audio.ts', `import { Howl } from 'howler';`)).toEqual([]);
    expect(messages('src/ui/x.ts', `import { Howl } from 'howler';`)).toHaveLength(1);
    expect(messages('src/platform/audio.ts', `import * as T from 'three';`)).toHaveLength(1);
    expect(messages('src/scene/x.ts', `import { Howl } from 'howler';`)).toHaveLength(1);
  });

  it('keeps ui away from three and render, and platform away from ui and render', () => {
    expect(messages('src/ui/x.ts', `import * as T from 'three';`)).toHaveLength(1);
    expect(messages('src/ui/x.ts', `import type { L } from '../scene/layout';`)).toHaveLength(1);
    expect(messages('src/platform/x.ts', `import { Hud } from '../ui/hud';`)).toHaveLength(1);
    expect(messages('src/platform/x.ts', `import { L } from '../scene/layout';`)).toHaveLength(1);
  });

  it('lets screens and app import anything', () => {
    const source = `import * as T from 'three';\nimport { Howl } from 'howler';\nimport { Hud } from '../ui/hud';\nimport { L } from '../scene/layout';`;
    expect(messages('src/screens/x.ts', source)).toEqual([]);
    expect(messages('src/activities/x.ts', source)).toEqual([]);
    expect(messages('src/app/x.ts', source)).toEqual([]);
    expect(messages('src/app.ts', source.replaceAll('../', './'))).toEqual([]);
  });

  it('keeps logic and content away from upward imports, and everything away from app and screens', () => {
    expect(messages('src/core/x.ts', `import { g } from '../app/screens';`)).toHaveLength(1);
    expect(messages('src/data/x.ts', `import { p } from '../core/progress';`)).toHaveLength(1);
    expect(messages('src/ui/x.ts', `import { g } from '../app/screens';`)).toHaveLength(1);
    expect(messages('src/core/x.ts', `import { id } from '../data/ids';`)).toEqual([]);
    expect(messages('src/scene/x.ts', `import { id } from '../data/ids';`)).toEqual([]);
    expect(messages('src/ui/x.ts', `import { id } from '../data/ids';`)).toEqual([]);
  });

  it('resolves `./app` from src/main.ts to src/app.ts, not the src/app/ folder', () => {
    expect(resolveImport('src/main.ts', './app', fakeExists)).toEqual({ kind: 'file', path: 'src/app.ts' });
    expect(resolveImport('src/main.ts', './app/screens', fakeExists)).toEqual({ kind: 'file', path: 'src/app/screens.ts' });
  });

  it('resolves .js to .ts and folders to index.ts', () => {
    const exists = (f: string) => f === 'src/core/a.ts' || f === 'src/core/b/index.ts';
    expect(resolveImport('src/core/x.ts', './a.js', exists)).toEqual({ kind: 'file', path: 'src/core/a.ts' });
    expect(resolveImport('src/core/x.ts', './b', exists)).toEqual({ kind: 'file', path: 'src/core/b/index.ts' });
  });

  it('fails an import that does not resolve, or that leaves src/', () => {
    const [missing] = messages('src/core/x.ts', `import { a } from './nope';`);
    expect(missing).toContain("imports './nope'");
    expect(missing).toContain('does not resolve');
    expect(messages('src/core/x.ts', `import { a } from '../../tools/size-report';`)).toHaveLength(1);
  });

  it('fails a file in a folder the map does not know', () => {
    const [message] = messages('src/assets/manifest.ts', `export const a = 1;`);
    expect(message).toContain('no layer for src/assets/manifest.ts: add it to LAYERS');
  });

  it('maps files to layers by the longest prefix', () => {
    expect(layerOf('src/flight/flightModel.ts')).toBe('Logic');
    expect(layerOf('src/flight/input.ts')).toBe('Platform');
    expect(layerOf('src/app.ts')).toBe('App');
    expect(layerOf('src/app/screens.ts')).toBe('App');
    expect(layerOf('src/style.css')).toBe('App');
    expect(layerOf('src/audio/speech.ts')).toBe('Platform');
    expect(layerOf('src/unknown/a.ts')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The real tree
// ---------------------------------------------------------------------------

const REPO = fileURLToPath(new URL('..', import.meta.url));

function listSrc(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSrc(rel));
    else out.push(rel);
  }
  return out.sort();
}

const realExists = (file: string) => statSync(path.join(REPO, file), { throwIfNoEntry: false })?.isFile() === true;

describe('src/ follows the layer rules', () => {
  const codeFiles = listSrc().filter((f) => /\.tsx?$/.test(f));
  const violations = codeFiles.flatMap((file) => checkFile(file, readFileSync(path.join(REPO, file), 'utf8'), realExists));
  const isAllowed = (v: Violation) => ALLOWED_BREAKS.some((a) => a.file === v.file && a.target === v.target);

  it('scans the real tree (a wrong path must not make everything pass)', () => {
    expect(codeFiles).toContain('src/main.ts');
    expect(codeFiles.length).toBeGreaterThanOrEqual(20);
  });

  // Code files only: Finder writes src/.DS_Store, and other tools drop dotfiles, which are not code and need no layer.
  it('gives every code file under src/ a layer', () => {
    expect(codeFiles.filter((f) => layerOf(f) === undefined)).toEqual([]);
  });

  it('has no import that breaks a rule, other than the allow-listed ones', () => {
    expect(violations.filter((v) => !isAllowed(v)).map((v) => v.message)).toEqual([]);
  });

  it('has no allow-list entry that no longer breaks a rule (remove it, so the list only shrinks)', () => {
    const stale = ALLOWED_BREAKS.filter((a) => !violations.some((v) => v.file === a.file && v.target === a.target)).map(
      (a) => `${a.file} -> ${a.target} no longer breaks a rule: remove this entry from ALLOWED_BREAKS`,
    );
    expect(stale).toEqual([]);
  });

  it('has no duplicate allow-list entries', () => {
    const keys = ALLOWED_BREAKS.map((a) => `${a.file} -> ${a.target}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
