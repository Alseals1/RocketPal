# Feature: fly-scene

Branch: `feature/fly-scene` (cut from `dev`). Second half of Phase 1 "Fly". Uses the already-merged `flightModel`, `quality`, `readout`, and `planets.json`.

## Goal
The first playable build: a kid opens the page, sees a 3D solar system with a placeholder rocket, flies with keyboard or touch, picks a destination, sees how far it *really* is, and docks. Done = it works on keyboard, touch layout, and tap-only (autopilot); the HUD shows real distance, light-travel time, and a "pretend speed"; low-quality mode turns itself on for slow devices; no console errors.

Landing, hotspots, and fact cards are Phase 2. Docking here ends with a friendly "You landed" card and a "Fly again" button.

## Approach
* **Scene scale (compressed):** Earth's orbit is 1,200 scene units; other orbits scale with the square root of the real distance (Neptune about 6,600). Body size is `8 * (diameter / Earth diameter)^0.45` (Sun fixed at 90), so small worlds stay visible. Planets sit at fixed angles around the Sun (no orbital motion, so docking and readouts stay simple); the Moon sits near Earth. At cruise speed (40 u/s) Earth is about 30 s from the Sun; boost (160 u/s) cuts it to under 10 s.
* **Rendering (`src/scene/`):** Three.js scene with lit spheres using small procedural canvas textures (no downloads yet), Saturn's ring, a glowing Sun, a star field that follows the camera, a placeholder rocket (cone, window, fins, engine flame), and a smooth chase camera. Glow sprites and star count follow the quality setting. Shadows are not used in Phase 1, so low mode trivially has none.
* **Controls (`src/flight/input.ts`):** keyboard (WASD or arrows to steer, up = nose up, Space = boost), a touch joystick and a large boost button (pointer events, `touch-action: none`), and tap-only access through **Where to?** plus an **Autopilot** button (hands-off flight at boost, which the flight model guarantees ends in docking). Touching the steering cancels autopilot.
* **HUD (`src/ui/hud.ts`, `src/style.css`):** DOM overlay. A card with the destination, *real* distance left (`realDistanceRemainingKm`), "light needs N minutes to get there", and "Pretend speed" with the note "Real rockets are much slower!" (from the PR #2 review: 87 million km/s must not look like real rocket speed). A big **Where to?** picker with all ten worlds, name tags that follow the bodies, an off-screen pointer arrow for the destination, and the landed card. HUD text updates 4 times a second and moves only with `transform` and `opacity` (per `animation-performance`).
* **Quality (`src/quality/monitor.ts` + existing `chooseQuality`):** frame times are sampled; every 2 s the chooser decides; low turns off glow, cuts stars, caps pixel ratio at 1. Starts low on weak hardware (`initialQuality`). `?quality=low|high` forces a mode for testing.
* **Accessibility in this PR:** keyboard, touch, and tap-only all work; targets are at least 56 px; high-contrast navy and yellow with a cyan focus ring (not colour-only: every world also has a name and a size); `prefers-reduced-motion` is honoured (no spin, no flame flicker, stiffer camera, no CSS animation). **Not in this PR:** the text-size selector and an in-game reduced-motion toggle (they need settings save/load, which gets its own tested feature), and read-aloud (Phase 4 with fact cards).
* **Test hook:** `?debug=1` exposes a small `window.rocketPals` object (ship state, target, quality, fps) so browser tests can check real behaviour. It is read-only information plus `pickTarget` / `setAutopilot`; no data is collected or sent anywhere.

## Files touched
New: `src/scene/layout.ts`, `src/scene/textures.ts`, `src/scene/spaceScene.ts`, `src/flight/input.ts`, `src/ui/hud.ts`, `src/quality/monitor.ts`, `src/scale/leg.ts` (added after review), `src/game.ts`, `tests/leg.test.ts`, `e2e/fly.spec.ts`. Changed: `src/main.ts`, `src/style.css`, `index.html`, `e2e/smoke.spec.ts`, `README.md` (how to play). No new dependencies.

## Skills / tools
`frontend-design` (HUD look: chunky, rounded, navy and sunny yellow, sticker-style outlines; no generic card kit), `animation-performance` (transform/opacity only, throttled DOM writes, pixel-ratio cap, no layout in the frame loop), `tdd` (only the seams agreed with the user: the auto-level change and the real-distance leg planning, which belong to the existing flight-model and readout/scale seams; everything else in the scene and UI is covered by Playwright), Playwright for browser checks, the Chrome browser tools for a real play-through and frame-rate reading.

## What the play-through changed (added while building)
* The rocket first started pointing at the Sun and flew into it within seconds: it now starts facing the inner planets.
* Holding "nose up" left the rocket staring at empty sky with no sense of "level". The flight model now eases the nose back to level when there is no pitch input and no destination (tested first; the destination pull is untouched, and all docking property tests still pass).
* On a phone held sideways the picker was cramped and name tags drew over it: three columns, full height, tags under the picker, Moon tag below its body so it does not cover Earth's.

## What the review changed (added after PR review)
* **The real-distance readout was wrong away from the last landed world** (it clamped to a Sun-based leg, so retargeting near Neptune showed 149.6 million km). The leg now starts from the world nearest the rocket (`src/scale/leg.ts`, tested first) and the readout no longer clamps.
* **The "only transform and opacity per frame" claim was not true.** The HUD now writes `hidden`, text and classes only when they change, and never reads layout in the frame loop (screen size is cached from the resize observer). A browser test counts the writes.
* The screen-reader announcement only fires when the destination changes (not 4 times a second); Escape closes the picker; clicking a button no longer steals the Space bar from boosting.
* Pinch-zoom is allowed again (it is the only way to enlarge text until the text-size setting exists).
* Input: browser shortcuts (Cmd/Ctrl/Alt) are ignored, each finger is tracked by id, and losing focus or hiding the tab lets go of keys, stick and boost.
* A friendly message when WebGL is missing; one bad frame can no longer freeze the game loop.
* "You're here" now follows where the rocket actually is (it used to stay on the last world you landed on).
* Browser tests now look at the real 3D pixels (not the HUD on top of them), watch the distance shrink, and cover the cases above. Each was checked by breaking the code on purpose.

## Risks
* **Frame rate on a school Chromebook is unproven.** I can only measure on this Mac; headless Playwright uses software GL, so its fps is not meaningful. Mitigations: about 15 meshes, tiny textures, no shadows, pixel-ratio cap, automatic low mode. Needs a real Chromebook check by the user.
* Full 3D flight is the hardest control scheme for ages 8-10. The play-through will judge the feel; tuning lives in `DEFAULT_FLIGHT`.
* Real distance for a leg is a "closest approach" estimate scaled by progress, so it is a teaching approximation, not navigation.
* Procedural textures are placeholders; real NASA/open textures and Blender models are listed in `ASSETS.md`.

## Testing
* `npm test` (102 existing unit tests must still pass), `npm run build`, `npm run test:e2e`.
* Playwright (`e2e/fly.spec.ts`): page loads with a rendering WebGL canvas and no console errors; keyboard steering, pitch and boost change the ship; picking a destination and autopilot docks; the touch layout appears on a touch device and the joystick and boost button move the ship; `?quality=low` disables glow.
* Real play-through in Chrome: fly Sun to Earth to Mars by keyboard, by touch layout, and by autopilot; read the frame rate; check the HUD numbers; note results in the PR.
