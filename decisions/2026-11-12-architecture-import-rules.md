# Architecture test: how the section 3 table is read

Date: 2026-11-12. Decided by the Plan agent for issue #37 and built by the Implement agent. Size S, so there was no plan gate: a person can overrule any line below at PR review. Each one is a single line in `MAY_IMPORT` (or `LAYERS`) in `tests/architecture.test.ts`, plus allow-list entries if the change makes code break.

## What was decided
1. **The table is a closed list.** If a layer's row does not name a thing, that layer may not import it. This also catches upward imports (logic importing `app/` or `screens/`), which the "may not import" column alone does not.
2. **Content (`data/`) is open to every layer.** Section 4 keeps the shared types (`data/ids.ts`, `data/content.ts`, ...) there ("everything else depends on them"), and Render and UI already use them.
3. **Platform may import Content and Logic.** `SaveStore` is built on `core/save/schema.ts` by design (section 4, #29).
4. **Screens may import App.** `app/screens.ts` holds the `Screen` interface every screen implements (section 4.11), and the row says "everything above".
5. **Type-only imports count.** The point is that layers do not know about each other; a type is still knowledge. This is why 7 type-only imports on `dev` are on `ALLOWED_BREAKS`.
6. **No split between type and value imports for the "... types" cells.** Render and UI already call pure logic (`DEFAULT_FLIGHT`, `qualitySettings`, `createQuizRun`), which drags in no `three` or DOM because Logic is itself checked.
7. **Render may import `src/ui/tokens.ts` and no other `ui/` file.** The file does not exist yet; the rule is ready for it.
8. **`audio/` and `flight/input.ts` map to Platform**, as section 2 and the table say they move there over time. `src/app.ts`, `src/main.ts`, `src/game.ts` and `src/style.css` map to App.
9. **A folder the map does not know fails the test** ("no layer for ..."), so new folders are classified on purpose.
10. **The DOM rule stays a review rule.** An import test cannot see `window`, `document`, `localStorage` or `navigator`.
11. **The allow-list is keyed by `(file, target)`**, so a new bad import in an allow-listed file still fails. An entry that no longer matches a real break fails the test, so the list only shrinks.
12. **Parsing is regexes over comment-free text.** Import-looking text inside a string is skipped.

## Why
- The test has to be strict enough that a layer cannot quietly wear away, and loose enough that it does not fight the shared-types design in section 4.
- Nothing in `src/` changes in this issue, so the breaks that exist today are listed, not fixed. Each entry says what removes it.

## Alternatives
- **Read the UI and Render rows literally (no `data/`):** would allow-list five legitimate shared-type uses.
- **Enforce only the "may not import" column:** misses upward imports and contradicts Content's "anything else".
- **Exempt `import type`:** would hide all 7 current breaks, and the layers would still know about each other.
- **Types-only edges for the "... types" cells:** about 5 more allow-list entries for harmless code, and a parser for mixed `import { a, type B }`.
- **A text search for `window.` and `document.`:** would flag `core/settings.ts`, `core/save/schema.ts`, `quality/quality.ts` and `data/surfaces.ts` with nothing to fix them yet.
- **The TypeScript compiler API for parsing:** the repo is on TypeScript 7, and its JavaScript API is not safe to depend on in a test.
