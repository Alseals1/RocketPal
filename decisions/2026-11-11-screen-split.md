# Screen split: `SpaceScreen`, `ArrivalScreen` and a small `ScreenManager`

Date: 2026-11-11. Decided by the Plan agent for issue #32 and approved at plan review; built by the Implement agent.

## What was decided
1. **The surface screen is `ArrivalScreen`, id `'arrival'`** (`src/screens/arrivalScreen.ts`), not `SurfaceScreen` as the issue says. The debug handle's `getMode()` still reports `'surface'` (the browser tests rely on it): it maps `'arrival'` to `'surface'` in one place.
2. **`Screen` and `ScreenId` are `docs/TECHNICAL_ARCHITECTURE.md` 4.11 as written**, including `pause()` and `resume()`. Nothing pauses a screen yet, so both screens make them no-ops and the manager never calls them.
3. **`ScreenContext` holds only what exists today** (`src/app/screens.ts`). `save`, `speech` and `go` match 4.11. The rest are stand-ins with their own names, each replaced when its 4.11 member arrives: `stage` (→ `overlays`), `scene` (the `SpaceScene` that owns the one `WebGLRenderer`, → `renderer`, #31), `controls` (→ `input`, #24), `data` (→ `content`, #38), `quality()` (→ `renderer.quality`), `reducedMotion()` (→ `settings`) and `isCovered()` (the settings panel is open, → `overlays`). `isCovered()` was not in the plan's list: the space HUD's landing card needs it, and today it is a callback on the HUD.
4. **Screens are made once and kept.** `SpaceScreen` keeps the ship, the target, autopilot and its `Hud` for the whole run, as today (the space HUD is hidden by the `is-surface` class during a visit). `ArrivalScreen` builds its `SurfaceHud`, look controller and picture on every visit and frees them all in `leave()`. Rebuilding the `SurfaceHud` per visit replaces today's cache per world, and fixes its `keydown` listeners (and the quiz panel's) staying after you leave.
5. **Enter, then leave.** `ScreenManager.go` enters the next screen while the current one keeps drawing, and leaves the old screen only once the new one has entered. That keeps today's landing: the HUD says "Landing on Mars..." over space until the picture is in. A failed `enter` leaves the new screen and keeps the old one. A screen still entering when `go` is called again (Back while loading) is left at once and never becomes active.
6. **`resize` goes to every screen**, active or not, as today (the hidden space HUD and the kept panorama both follow the screen size).
7. **A new debug member, `getRenderMemory()`**, returns a copy of `renderer.info.memory` (textures, geometries). It is added, not changed (section 9), for the browser test that checks a leaving screen frees what it used.
8. **`Game` moves to `src/app/game.ts`** as a shell under 150 lines; the debug handle moves to `src/app/debugHandle.ts`.

## Why
- `'arrival'` is the approved 4.11 `ScreenId`, and section 10 already says "`SpaceScreen` and `ArrivalScreen`". In 2.0 the same screen also shows fly-by worlds (4.9), so "surface" would soon be too narrow.
- Section 11 of the architecture: "each interface arrives with its first real user". Empty stubs of `EventBus`, `AssetManager` and the rest would be guesses.
- Async `enter` ("acquire assets") is what 4.11 has for loading a picture before the screen shows.

## Alternatives
- **Keep the name `SurfaceScreen`:** changes the approved 4.11 `ScreenId`, and means a rename when fly-by arrives.
- **Switch screens at docking and have `ArrivalScreen.update` draw space while loading:** ties the arrival screen to space drawing.
- **Destroy and rebuild the space `Hud` on every visit:** risks losing HUD state (stats, picker) for no gain; #31 and the Star Map will reshape it anyway.
- **The full 4.11 `ScreenContext` with empty stubs:** see Why.
- **Leave `pause`/`resume` out of `Screen`:** changes a shared type for the sake of two empty methods.
- **Pass `isCovered` to `SpaceScreen` on its own instead of through the context:** the overlay stack will answer this question for every screen, so it belongs with the other stand-ins.
