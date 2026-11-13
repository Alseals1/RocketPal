/**
 * The design tokens Three.js and TypeScript need: docs/VISUAL_DESIGN.md section 4.
 *
 * Every colour here is also a custom property in src/ui/styles/tokens.css, with the same
 * name (camelCase here, kebab-case there) and value. tests/tokens.test.ts fails if they differ.
 * No imports: the Render layer may import this file (tests/architecture.test.ts).
 */

/** Colour tokens, keyed by the CSS name in camelCase without the leading `--`. */
export const COLORS = {
  // 4.1 Space
  space950: '#05060f',
  space900: '#0b1030',
  space800: '#141b47',
  space700: '#1f2862',
  nebulaViolet: '#3b2a7a',
  nebulaTeal: '#0f4c5c',

  // 4.1 Glass
  glassFill: 'rgba(11, 16, 48, 0.75)',
  glassFillStrong: 'rgba(11, 16, 48, 0.86)',
  glassFillLight: 'rgba(11, 16, 48, 0.55)',
  glassEdge: 'rgba(255, 255, 255, 0.16)',
  scrim: 'rgba(5, 6, 15, 0.55)',

  // 4.1 Text
  textPrimary: '#ffffff',
  textSoft: '#c9d2f2',
  textOnAccent: '#12163d',

  // 4.1 Meaning
  signalGold: '#ffd166',
  signalGoldDeep: '#e8a317',
  holoCyan: '#7bdff2',
  holoViolet: '#a78bfa',
  doneMint: '#6ef0b5',
  /** About 4.2:1 on glass over white: a graphic colour only, never text. */
  retryCoral: '#ff9e7a',
  starGold: '#ffc93c',

  // 4.1 Worlds
  worldSun: '#ffb547',
  worldMercury: '#b8afa6',
  worldVenus: '#e9c46a',
  worldEarth: '#4fa3e0',
  worldMoon: '#d4d6e0',
  worldMars: '#e2673f',
  worldBelt: '#a8957e',
  worldJupiter: '#d9a066',
  worldSaturn: '#e8d08c',
  worldUranus: '#8fe3e8',
  worldNeptune: '#5672f5',

  // Legacy: today's screens, removed in M8 (see tokens.css).
  legacyPage: '#03040c',
  legacyNavySoft: 'rgba(18, 22, 61, 0.86)',
  legacyNavyGlass: 'rgba(18, 22, 61, 0.55)',
  legacyOverlay: 'rgba(3, 4, 12, 0.6)',
  legacyOverlayLight: 'rgba(3, 4, 12, 0.55)',
  legacyTile: 'rgba(255, 255, 255, 0.1)',
  legacyTileHover: 'rgba(255, 255, 255, 0.2)',
  legacyBoost: '#ff8c42',
  legacyBoostEdge: '#b9541a',
  legacyQuizWrongEdge: '#8a90b8',
  legacyQuizWrongText: '#c9cdea',
  legacyWindowWall: '#080a16',
  legacyWindowEdge: '#4b5170',
  legacyCardShadow: 'rgba(0, 0, 0, 0.35)',
  legacyWindowShade: 'rgba(0, 0, 0, 0.75)',
  legacySpotGlow: 'rgba(255, 209, 102, 0.85)',
  legacySpotFoundGlow: 'rgba(123, 223, 242, 0.7)',
  legacyArrowShadow: '#000000',
} as const;

export type ColorToken = keyof typeof COLORS;

/**
 * Section 4.5 breakpoints, in CSS px. CSS uses the same numbers as literals in `@media`.
 * compact: width below 600 · short: height below 520 · medium: 600-1199 wide · wide: 1200 and up.
 */
export const BREAKPOINTS = {
  compactMaxWidth: 599,
  shortMaxHeight: 519,
  mediumMinWidth: 600,
  wideMinWidth: 1200,
} as const;

/** `'#rrggbb'` (or `'#rgb'`) to a number Three.js takes, for example `new THREE.Color(hexToNumber(COLORS.legacyPage))`. */
export function hexToNumber(hex: string): number {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return parseInt(h, 16);
}
