# Star Map and Mission Control

Date: 2026-11-21. Decided by the Plan agent for issue #42 and built by the Implement agent (parts 2 and 3 of a stack of 3; part 1, the thumbnails, is in `decisions/2026-11-21-planet-thumbnails.md`). Items marked "build change" were made during the build. A person can overrule any line at PR review. The code is in `src/app/screenManager.ts`, `src/app/missionControl.ts`, `src/ui/missionControl.ts`, `src/ui/missionsTab.ts`, `src/ui/missionsModel.ts`, `src/ui/settingsPanel.ts` (`SettingsTab`) and `src/ui/components/tabs.ts`.

## What was decided
1. **Pausing lives in `ScreenManager`.** `setPaused(on)` calls `pause()` or `resume()` on the active screen, and while paused `update()` sends no frames. A screen that becomes active while paused (a picture that finished loading under Mission Control) is paused at once. Resizes still reach every screen; a paused screen draws itself once in `resize()`, because a resized canvas is blank until the next frame. `Game` keeps the frame clock running but does not count paused frames for the quality monitor.
2. **Only Mission Control pauses the game.** The Star Map does not (7.4 puts it over a "still-moving scene"); it only blocks steering.
3. **Mission Control shows only the tabs that work:** Missions and Settings. The Hangar, Journal and Patches tabs come with their issues; there is no "coming soon".
4. **Escape opens Mission Control only in space** (7.2), and only when the space HUD has no panel of its own open (the landing card, the destination list): Escape closes those instead. On a world's surface Escape already closes cards, so there it does nothing new; the menu button still opens Mission Control there.
5. **One Escape closes one thing.** Mission Control listens for keys on the `document`, answers only while its scrim is the topmost `.rp-scrim` (as `openDialog` does), and stops a closing Escape there, so the game's `menu` action (on `window`) never sees it and cannot re-open the sheet. It also stops Tab there, so a fact card left open under the sheet cannot pull Tab back to itself.
6. **`isCovered()` is widened, not replaced.** `ScreenContext.isCovered()` now means "Mission Control is open". The section 4.11 `OverlayStack` is not added: it has no defined interface yet. No shared type in section 4 changed. `SpaceParams` (the space screen's own params) gains `course`.
7. **Go sets course the same way from everywhere.** From space it targets the world (`SpaceScreen.setCourse`, which lifts off first from the plain landing card). From a world's surface it goes back to space with `{ liftOff: true, course }`. The Missions tab lists every mission from the Sun outwards; the first open one has the primary Go and the others a secondary Go; a done mission says "Done!", and the mission where you are says "You are here".
8. **Mission rows are static tiles (build change).** A tile is a button, and a Go button cannot sit inside another button. `createTile` gained a `static` option that draws the same tile as a `div` that does nothing when pressed, with Go beside it.
9. **The Settings tab is today's panel, moved in (build change to the footer).** Same four groups, same radio keys, same `data-testid`s and the same saving. Done closes Mission Control. Done now sits in a footer under the choices, which scroll above it: the old sticky footer let choices slide under Done, which the overlap check (rightly) counted as an overlap.
10. **The menu button is an icon button named "Mission Control"** (`aria-haspopup="dialog"`, `aria-expanded`), where the gear was. On open, focus goes to the selected tab; on close, to the game area (as every panel does, so Space boosts again).
11. **The tabs component shows the two real tabs in the component gallery (build change).** With a third made-up tab the row scrolls sideways on a phone (as 7.6 says it should), and the gallery's size check counts a scrolled-away tab as off the screen.

## Why
- 7.2 and 7.6 (decision 6) put Settings behind one menu button, and 7.6 says the game pauses behind Mission Control. Pausing in the screen manager means every screen, today's and later ones, pauses the same way.

## Alternatives
- **Building the tabs from `createSegmented`:** it is a radio group, not ARIA tabs with panels.
- **Adding `OverlayStack` now:** a section 4.11 contract with no interface yet; widening `isCovered()` is enough for one sheet.
- **Pausing for the Star Map too:** 7.4 asks for a moving scene behind it.
- **Escape opening Mission Control on a world's surface:** Escape closes the fact card and the quiz there, and one key doing both would surprise a kid.
