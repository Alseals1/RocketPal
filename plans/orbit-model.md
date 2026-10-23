# Feature: orbit-model

Branch: `feature/orbit-model` (cut from `dev`). Orbit, the robot guide, built in Blender: a round floating robot with two big eyes and a tiny antenna. It replaces the plain SVG placeholder face on the landing screen.

## Goal
Orbit looks friendly and the same everywhere. On the landing screen the kid sees Orbit's real face: calm while it talks, **happy** when they find something, **thinking** while the picture loads. Done = the Blender model exists as `public/models/orbit.glb` (all expressions in it), three portraits rendered from it are shown in the landing screen, and the screen still reads the same to a screen reader.

## Decisions made with the user
* "Yes, use your recommendation for Orbit" (2026-10-23): the design in `ASSETS.md` (floating round body, two big eyes with blink / happy / thinking, tiny antenna, 3,000 triangles).

## Design
* **Body:** a round white (`Hull`) shell, slightly squashed, with a dark navy face plate on the front and two small orange side pods like ears. Chunky and rounded, nothing sharp.
* **Eyes:** big, sky-blue and glowing (same palette as the ship and the old placeholder: white, navy, sky blue, orange, gold; separable by lightness for colour-blind kids).
* **Antenna:** one thin gold stalk with an orange ball. Short and soft.
* **Expressions** are separate parts the game switches on and off: `Expr_Neutral`, `Expr_Happy` (curved happy eyes, big smile), `Expr_Think` (eyes looking up and aside, raised brow, small flat mouth), `Expr_Blink` (closed eyes). Each is one mesh part holding that expression's eyes, mouth and brow.
* Faces are friendly only. No angry, sad-crying, or scary looks.

## Approach
* **Build in Blender** (MCP) in a separate scene, same as the ship (the user's open Blender file is untouched; the scene is removed afterwards; the source is saved as `assets-src/orbit.blend`).
* **Export** `public/models/orbit.glb`: plain glb, no textures, nodes `Orbit` > body parts + the four `Expr_*` groups; nose/forward is -Z like the ship. Materials `Hull`, `Plate`, `Eye`, `Accent`, `Antenna`. Back-face culling on. Budget 3,000 triangles in total (all expressions counted).
* **Portraits:** three transparent PNGs rendered from the same model in Blender (`public/images/orbit-neutral.png`, `orbit-happy.png`, `orbit-thinking.png`), 192 px, shown at 64 px (sharp on a phone). Blink is in the model for later 3D use but is not shown yet (no blink animation: nothing in the landing screen blinks, so it is also reduced-motion safe).
* **Why portraits and not the 3D model on screen:** a second WebGL view for a 64 px face would cost a whole extra render context on a school Chromebook. Flat pictures cost nothing per frame and read the same. The glb is delivered and tested now so 3D Orbit (for example floating beside the ship) can use it later; nothing loads it yet.
* **Landing screen** (`src/ui/surfaceHud.ts`, `src/style.css`): the SVG face is replaced by the three pictures, one visible at a time, chosen by a `data-mood` attribute on Orbit's face: `thinking` while the picture loads, `neutral` once Orbit has spoken the hint, `happy` from the first find to the end of that visit (Orbit says "Nice find!" after "Got it", so a happy face fits). A new visit starts again from `thinking`. Pictures are decorative (`alt=""`); the speech bubble stays the one thing a screen reader announces, so the accessible text does not change.
* **Docs:** `ASSETS.md` (Orbit done), `CREDITS.md` (original work), a decision note.

## Files touched
New: `plans/orbit-model.md`, `public/models/orbit.glb`, `public/images/orbit-{neutral,happy,thinking}.png`, `assets-src/orbit.blend`, `tests/orbitModel.test.ts`, `e2e/orbit.spec.ts`, `decisions/2026-10-23-orbit-*.md`. Changed: `src/ui/surfaceHud.ts`, `src/style.css`, `ASSETS.md`, `CREDITS.md`, possibly `src/game.ts` (to tell the screen when the picture is loading, if it does not already).

## Skills / tools
Blender MCP (build, look at renders, export, render the portraits), `frontend-design` (the face on the landing screen: size, spacing, kid-friendly), `animation-performance` (no animation added; flat images, no layout changes; `will-change` not needed), `tdd` (file-contract seam as for the ship; mood wiring is UI and is covered in the browser only). `grill-me` is not loadable in this session (confirmed earlier), so gaps are listed by hand.

## Gaps looked for (by hand)
* Looks scary or odd: check every expression rendered at 64 px and at full size, with the biggest text too.
* Face covers text or buttons on small phones: size stays 64 px, same box as before, so layout does not change (checked by the existing small-screen layout test plus a look).
* Portrait fails to load: the speech bubble still carries every word; nothing breaks (tested by blocking the images).
* Screen reader sees extra stuff: images are `alt=""` and the face stays `aria-hidden`; a test pins that Orbit adds no new announcement.
* Reduced motion: nothing moves.
* Weight: three small PNGs, loaded only on landing (page load unchanged); total size shown in the PR.
* Licence: original work; recorded in `CREDITS.md`.

## Risks
* Blender's glTF export can lose the `Expr_*` group names or put them under the wrong parent (the file test checks).
* A 192 px render may look soft at 3x phone screens; check, and bump to 256 px if needed.
* Unmeasured on a Chromebook, like everything else.

## Testing
* Vitest: `tests/orbitModel.test.ts` reads `orbit.glb`: part names (`Expr_Neutral/Happy/Think/Blink`, the five materials), triangle and size budget, no textures, no double-sided materials, no cameras/lights/animations, faces forward (-Z), antenna is the top, expressions sit in front of the body.
* Playwright: landing at Mars and Earth shows Orbit's picture loaded (non-zero size), `data-mood` is `thinking` while loading (and Orbit is really on top of the loading screen, not hidden behind it; the dots and the bubble wait), `neutral` after the hint, `happy` after finding a dot and until the visit ends; each mood shows its own picture; dots are drawn above Orbit; with the images blocked the screen still works with no console errors; the screen reader text did not change.
* Real look in the game and on phone-sized screens with the biggest text.

## What building and looking changed (added while building)
* The first body used too many triangles (3,640 against the 3,000 budget, mostly from smooth eyes and the face plate); rebuilt with less detail: 2,144 triangles, 56 KB.
* Renders looked right (friendly in all three faces), but the first portraits only filled 70 percent of the 64 px box, so Orbit looked smaller than the old face; framed tighter.
* Test strength: the first version of the mood tests passed even if loading never set `thinking` (the page starts as thinking). Test 3 now lands on Mars twice with the picture slowed down and requires `thinking` on the second landing. Three mutations are caught: no happy on a find, loading never ends calm, loading never thinks. A dead `neutral` line in `reset()` was removed.
* `Expr_*` are mesh nodes (not empty groups) in the glb; the file test checks names, budget, no textures, no double-sided materials, faces front (-Z), antenna up, size.
* Known and left: on a small phone a dot can still sit over Orbit (cosmetic, as for the credit card; noted earlier for the Earth window).

## What the PR review changed (added after review)
**Round 1**
* **The thinking face was never seen**: the loading screen (opaque, `z-index: 6`) covered Orbit, and the first test only checked the picture was "visible" in the page-layout sense. Orbit now sits at the same level but later on the page, so it shows above the loading screen; the test asks the browser what is on top at Orbit's spot.
* The tests now check each mood shows its own picture file (the reviewer swapped all three to one file and nothing failed).
* The portraits had a local file path in their metadata; the text chunks are stripped and a test pins that no portrait contains text.
* `ASSETS.md` says to hide all but one `Expr_*` when the model is used in 3D (a glb has no "hidden by default").
* The ship browser tests (already in `dev`) asked for the test handle before the game had started and failed 3 of 72 runs under load; they now wait (96 of 96 and 120 of 120 pass under load).

**Round 2** (the round 1 fix caused two new problems)
* **Orbit and its bubble were drawn over the glowing dots** (raising Orbit reversed the old stacking). The dots layer is now level with Orbit but later on the page, so a dot is above Orbit again, as before. The fact card (10), Back to space (7) and the gear (8) are above both.
* **At 320 px wide with the biggest text, Orbit's bubble covered the loading words** on the Earth landing. While loading, the dots and the bubble now wait (hidden), so only Orbit's face shows on the loading screen. Side effects, both good: Orbit no longer says "Drag to look around" before the picture is there, and a dot can no longer be opened from the keyboard behind the black loading screen (this was already possible before this feature). Because of that, the "a find made behind the loading screen" rule added in round 1 is gone (nothing can be found while loading).
* New tests: dots and bubble wait while loading and the dot cannot be focused until loading ends; at 320 x 568 with the biggest text, on Mars and on Earth, Orbit's face does not touch the loading words and the bubble waits; a dot parked over Orbit's face is drawn above it, and an open fact card is above Orbit. Mutations caught: dots layer not above Orbit; nothing waits while loading; Orbit not above the loading screen.
* Left and known: a flash of an empty 64 px box if a portrait arrives late (cosmetic). At 320 px wide with the biggest text on Mars the title card is very narrow and tall (existing; a small-screen follow-up, not part of Orbit).
