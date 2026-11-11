# Feature: settings

Branch: `feature/settings` (cut from `dev`). Closes the two accessibility items deferred from `fly-scene`: adjustable text size and a reduced-motion option. First work for Phase 2 because every later screen (fact cards, quiz, journal) builds on it.

## Goal
A kid or a grown-up can make all game text bigger and turn motion down, and the game remembers it on that computer. Done = a **Settings** button opens a panel with three text sizes and three motion choices; the choice applies at once, survives a reload, and the game still works if the browser will not save anything.

## Decisions made with the user
* Three text sizes: **Normal, Big, Extra big** (1x, 1.25x, 1.5x).
* Test seams (agreed): (1) settings load/save; (2) effective values (text size to scale, reduced-motion choice to yes/no). The panel itself is covered by Playwright.

## Approach
* `src/core/settings.ts` (pure): `Settings` = `{ textSize: 'normal' | 'big' | 'huge', reducedMotion: 'system' | 'on' | 'off' }`; `loadSettings(storage)`, `saveSettings(settings, storage)`, `textScale(size)`, `effectiveReducedMotion(choice, systemPrefersReduced)`. Saved in `localStorage` under one key, as JSON with a version number. Bad or unknown saved values fall back to the default for that field only; unreadable storage means defaults and no crash; failing to save never throws.
* `src/ui/settingsPanel.ts`: a round **Settings** button (inline SVG gear, `aria-label`) under **Where to?**, and a panel with two groups of big buttons (`role="radiogroup"`, `aria-checked`, arrow keys / Home / End move through and pick the choices), **Done**, Escape to close. It is modal: Tab stays inside it while open, and the game ignores the steering and boost keys while it is open (the rocket just cruises). On close, focus goes to the game area (not back to the gear, because Space is the boost key), so the next Tab starts at the top of the page. Plain words for kids: "Reduce motion: Same as my computer / On / Off".
* Applying a setting: text size sets the `--ui-scale` CSS variable (all UI text already uses `em`); reduced motion sets `data-reduced-motion` on the page and tells the 3D scene (stops planet spin and flame flicker, stiffer camera) and the CSS (no transitions). "Same as my computer" follows the operating-system setting, live.
* The CSS reduced-motion rule moves from the media query to the data attribute so the in-game choice can override either way.
* Settings are the only thing stored; no progress, no personal data, nothing is sent anywhere.

## What the real-browser look changed (added while building)
* Closing the panel (or the destination picker) no longer hands focus back to its button: Space is the boost key, and on a focused button Space would press it again instead of boosting. Tested for every way of closing.
* With the biggest text on a phone, Autopilot sat on top of the stick and BOOST (portrait), BOOST's label overflowed its circle, name tags drew over the stats card, panels were see-through, and the settings panel was clipped top and bottom in landscape. All fixed, each with a browser test that fails without the fix. The settings panel is compressed on short screens so Done is visible without scrolling.
* The stats card is narrow on a 420 px wide phone at Extra big (about 200 px, so the text wraps over many lines). It is readable and nothing overlaps, so it stays; a better phone-portrait layout belongs with the later HUD polish.

## Files touched
New: `src/core/settings.ts`, `src/ui/settingsPanel.ts`, `tests/settings.test.ts`, `e2e/settings.spec.ts`. Changed: `src/main.ts`, `src/game.ts`, `src/scene/spaceScene.ts`, `src/style.css`, `README.md`.

## Skills / tools
`tdd` (the two agreed seams, red first), `frontend-design` (panel in the same navy and sunny-yellow sticker style, big targets), `animation-performance` (no new per-frame work; panel opens without animating layout), Playwright and the Chrome tools for a real look at each text size on desktop and phone sizes.

## Risks
* Extra big text on a small phone could overflow the stats card or picker: check at 420x900 and 844x390 and fix layout if needed.
* While the panel is open the rocket keeps flying (no pause). Acceptable for now; a pause belongs with the later menu work.
* `localStorage` can be blocked (private mode, school policies): the game must still run and say nothing scary.

## Testing
* Vitest (`tests/settings.test.ts`): defaults, round trip, corrupt JSON, unknown or wrong-type values per field, storage that throws on read or write, no storage at all; scale numbers; reduced motion for system/on/off against both OS answers.
* Playwright (`e2e/settings.spec.ts`): panel opens and closes (button and Escape), 56 px targets, text size changes the real font size and survives a reload, reduced motion on/off/system works against an emulated OS setting, and the page works with blocked storage and no console errors.
* Real look in Chrome at all three sizes on desktop and both phone shapes.
