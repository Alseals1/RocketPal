# Feature: ship-model

Branch: `feature/ship-model` (cut from `dev`). The first real Blender model: the player's rocket ship, built in Blender through the Blender MCP and exported as glTF, replacing the placeholder cylinder-and-cone rocket.

## Goal
The kid sees a friendly, rounded rocket with a big cockpit window instead of the plain placeholder. Done = the rocket in the game is the Blender model, its engine flame still grows when boosting, nothing changes about how it flies, and the game still works if the model file fails to load.

## Why only the ship
The ship is on screen every second of play, so it is the model that matters most. Rover, astronaut, Orbit, flag, comet, satellite and asteroids stay in `ASSETS.md` for later features, one model family per PR so each can be reviewed by looking at it.

## Decisions made with the user
* Blender models first (2026-10-23), ahead of missions and quiz.

## Approach
* **Build in Blender** (MCP, Blender 5.2): low-poly, rounded, chunky. Hull (white), trim (orange nose sleeve and three rounded fins; the part a later upgrade can recolour), cockpit window (sky blue, slight glow), a dark nozzle, and a separate `Flame` object. Nose points along Blender +Y, which exports to glTF -Z, the flight model's forward direction. Budget 3,000 triangles; aim for about 1,500.
* **Palette** colour-blind safe (white, orange, sky blue are separable by lightness as well as hue), same hues as the placeholder so nothing else on screen changes.
* **Export** to `public/models/ship.glb` with only what the game needs (no cameras, no lights, no animation). Materials are named `Hull`, `Trim`, `Window`, `Dark`, `Flame` so code can find them.
* **Game**: `src/scene/shipModel.ts` loads `ship.glb` lazily with Three's `GLTFLoader` after the first frame, swaps it in for the placeholder, and finds `Flame` so the existing flame scaling keeps working. If loading fails, the placeholder stays and the game carries on (no error screen, nothing scary for a kid).
* **Compression**: the file is small enough that mesh compression would add a decoder download larger than it saves, so it ships as plain `.glb`. Logged in `decisions/`; CLAUDE.md's "compressed glTF" is meant for the large models later.
* **Blender file**: the user's open Blender file is an unsaved crystal scene. It is not touched. The ship is built in a new scene inside it, exported, and that scene is removed afterwards. The source `.blend` is saved in the repo as `assets-src/ship.blend` (kept so the model can be edited later).

## Files touched
New: `plans/ship-model.md`, `public/models/ship.glb`, `assets-src/ship.blend`, `src/scene/shipModel.ts`, `tests/shipModel.test.ts`, `e2e/ship-model.spec.ts`, `decisions/2026-10-23-ship-model-*.md`. Changed: `src/scene/spaceScene.ts`, `ASSETS.md` (row done), `CREDITS.md` (original work), `README.md` if the build notes change.

## Skills / tools
Blender MCP (build, look at renders, export), `tdd` (the file-contract test), `animation-performance` (one small mesh, no per-frame allocation, flame scaling unchanged), Playwright (smoke and a real look in Chrome). `grill-me` could not be loaded in this session ("Unknown skill" for both `grill-me` and the `grilling` skill it points to), so the gap check below was done by hand.

## Gaps looked for (by hand, in place of grill-me)
* Wrong way round or wrong size in game: the model is checked against the flight model's forward direction and the placeholder's length (about 3.4 units), and looked at in the real game.
* Flame: placeholder flame scales along its own length; the glTF flame must do the same from the same pivot (checked by test of node names and a look at boosting).
* Load failure or slow network: placeholder first, model swaps in; a test blocks the file and checks the game still flies with no console errors.
* Memory and speed: one mesh group, a few materials, under 3,000 triangles; no new per-frame work.
* Licence: all original work, no downloaded parts; recorded in `CREDITS.md`.
* Scary or sharp: no sharp points; rounded nose.

## Risks
* Blender's glTF exporter converts axes and materials; flame pivot and nose direction could come out wrong (caught by the in-game look).
* Lighting: the placeholder had emissive tints so it never goes dark when the Sun is behind. The model's materials need the same (emission on `Window`, `Flame`; a little on `Hull`).
* Unmeasured on a Chromebook (as with everything so far).

## Testing
* Vitest: a file-contract test reads `ship.glb` and checks it is a valid glb, has the named parts (`Flame` plus the `Hull`, `Trim`, `Window` materials), is under 3,000 triangles and a small size, and its nose points forward. This is a data-validation seam like `planets.json`.
* Playwright: game loads with the model, no console errors; with the file blocked the game still loads and flies.
* Real play-through in Chrome: fly, boost (flame grows), land, check from behind the ship; keyboard and touch layout unchanged.

## What building and looking changed (added while building)
* First shapes looked like a fish (stubby body, small window dome, fins like ears). The body is longer, the window bigger, the fins smaller and straight, and the nose cone is slightly wider than the body so the two do not flicker where they meet.
* Seen from the game's chase camera, the flame's wide end covered the whole back of the ship like a yellow ball. The flame is narrower (radius 0.26, was 0.4), so the dark nozzle shows.
* Result: 1,782 triangles, 37 KB, 5 materials. The file-contract test pins the nose direction (-Z), the flame's pivot and direction, the part names and the budget. Two browser tests: the model replaces the placeholder with no console errors, and with the file blocked the game still flies with no console errors. Mutation checks: removing the failure handler fails the second test; never swapping the model fails the first.
* The `grill-me` skill is not available in this session; gaps were listed by hand (above).
* Not done in this feature: the "3 swappable colour trims" upgrade idea (one `Trim` material is ready for it).
