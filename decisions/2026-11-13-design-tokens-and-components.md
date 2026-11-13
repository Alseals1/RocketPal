# Design tokens, fonts and components (M3, #21)

Date: 2026-11-13. Made by the G.O.A.T. Implement agent from the approved plan on #21.

## What was decided

1. **Legacy tokens.** `src/ui/styles/tokens.css` holds the `docs/VISUAL_DESIGN.md` section 4 tokens exactly. Today's values that have no exact token (for example the page colour `#03040c`, `navy-soft` `rgba(18,22,61,0.86)`, the orange Boost) go into a marked `--legacy-*` block in the same file with today's values. Values with an exact token use it (`--sun` → `--signal-gold`, `--sky` → `--holo-cyan`, `--navy` → `--text-on-accent`, `--ink` → `--text-primary`). The M8 restyle (#55, #56) moves today's screens onto the new tokens and deletes the legacy block.
2. **Only tokens.css holds colours and font names.** `tests/styles.test.ts` fails on a colour literal (`#hex`, `rgb(a)(`, `hsl(a)(`) or a raw `font-family` in any other stylesheet under `src/`. `tests/tokens.test.ts` keeps `tokens.css` and `src/ui/tokens.ts` in step.
3. **`--gap` stays as a layout alias.** `src/style.css` keeps `--gap: var(--space-3)` instead of writing `var(--space-3)` everywhere, because the surface screen on a short phone narrows it to 8 px (`.stage.is-surface { --gap: 8px }`). Overriding a design token inside one screen would be worse. The alias goes in M8 with the rest of today's layout.
4. **Fonts come from the published Latin subsets.** Fredoka 600 and Lexend (variable weight 100-900), from `@fontsource/fredoka@5.3.0` and `@fontsource-variable/lexend@5.3.0`, taken once with `npm pack` in a folder outside the project. Nothing is added to `package.json`. One variable Lexend file covers every weight today's CSS uses (600-900) and the tokens use (400-600). 56,148 bytes in total; the unit test's budget is 100,000. Both are SIL OFL 1.1 with no Reserved Font Name; files are unmodified. Sources and hashes are in `CREDITS.md`, licence texts in `public/fonts/`.
5. **Fonts are preloaded and swap.** `index.html` preloads both files; `@font-face` uses `font-display: swap`. Browser tests wait for both fonts (`e2e/fonts.ts`) before measuring layout.
6. **Reduced motion stays a cut.** Section 8 allows "a fade of 150 ms or less, or a cut". The existing global rule (no transition, no animation) stays, and the `--dur-*` tokens become `0ms` too. A fade can come later without changing components.
7. **`--retry-coral` is a graphic colour only.** It is about 4.2:1 on `--glass-fill` over white, under the 4.5:1 text bar. It is used for crosses and edges, never text. The contrast test checks both facts.
8. **Dialogs use `--dur-panel` (320 ms).** Section 8 says dialogs open in 240 ms, but section 4.4 has no 240 ms token. Using the panel token keeps one source.
9. **Breakpoints are literal px in `@media`.** Custom properties cannot be used in media queries. The values live in `BREAKPOINTS` in `src/ui/tokens.ts`.
10. **Components use the `rp-` prefix** and live in `src/ui/styles/components.css` and `src/ui/components/`, so nothing in today's screens changes until a screen uses them.
11. **The component gallery is built only for the browser tests.** `gallery/components.html` is added to the Vite build only when `RP_GALLERY=1`, which `playwright.config.ts` sets. A normal `npm run build` ships only the game, and nothing in the game links to the gallery.
12. **Titles use Fredoka 600.** `.stats-title`, `.picker-title` and the card titles (`.landed-card h2`, `.fact-card h2`, `.settings-card h2`, `.context-lost-card h2`). The quiz question stays Lexend (section 4.2: questions are body text). Fredoka ships at 600 only, so those titles drop from weight 700-800 to 600.

## Why

The acceptance for M3 is "today's screens look the same apart from the fonts and the settings fix". Mapping today's colours onto the nearest new token would change the look now; the legacy block makes drift impossible and gives M8 one place to delete.

## Alternatives considered

* Fontsource as an npm dependency: a "new dependency" gate hit, for files that never change.
* Subsetting the TTFs ourselves (`pyftsubset`): needs a new tool; the published subsets already exist.
* Static Lexend files per weight: five or more files, over the budget.
* Gallery as a route inside the game, or shipped unlinked in every build: test code reachable in the kids' game.
* A 150 ms fade for reduced motion: allowed but not needed now; the existing tests rely on the cut.
