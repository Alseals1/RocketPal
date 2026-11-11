# Rocket Pals: project audit

Date: 2026-11-11. A technical and gameplay audit made before Rocket Pal 2.0 work starts. Nothing was changed to make it.

**What was audited:** `dev` at `66580bb` plus the missions-and-quiz review fixes in PR #14 (the version the game will be at once that PR merges).

**How:** all of `src/`, `public/data/`, `tests/` and `e2e/` were read. Both `.glb` models were parsed (meshes, triangles, materials). The real flight model was run under Node for all 90 world-to-world trips. `npm test` (277 passed), `npm run build` (clean) and `npm run test:e2e` (136 passed) were run.

**Not done:** no frame-rate, memory or voice measurement on a real Chromebook, and no play-through by a child. Every GPU cost below is an estimate and says so. Measuring on a real Chromebook is the first item in the roadmap for this reason.

Severity: **High** blocks 2.0 or teaches something wrong; **Medium** will hurt as the game grows; **Low** is worth fixing when the code is touched.

## Summary

Rocket Pals has an unusually solid base. The game logic is pure and heavily tested, content is checked by code against dated NASA sources, accessibility and privacy are tested in the browser, and the scene is very light on the GPU. What it lacks is game. Steering never changes the outcome of a flight, eight of ten worlds end on a "coming soon" card, the only interactions are tap, read and multiple choice, and a child can finish everything in about 15 minutes with nothing pulling them back.

So the 2.0 order recommended here is: make it safe to grow (fix, measure, test automatically), then make the loop worth playing (every world has something, flights need skill, a first action game, visible progress), then make kids come back (unlocks, a journal), and polish the look and sound around that.

---

## 1. Application architecture

**Today.** `src/main.ts` checks WebGL, applies saved settings, loads the JSON data (each optional file fails soft), then creates `Game`. Pure modules: `flight/`, `scale/`, `quality/`, `quiz/`, `core/`, `data/`, `surface/geometry.ts`. Rendering and DOM: `scene/`, `surface/`, `ui/`, `audio/`. Details are in `TECHNICAL_ARCHITECTURE.md`.

**Strengths.** Clear split between pure logic and rendering; content lives in JSON; every optional data file can fail without stopping the game; one bad frame is reported once and the game keeps going (`src/game.ts:201`).

**Weaknesses.**
* **Medium.** `src/game.ts` (504 lines) owns the loop, both modes (`mode: 'space' | 'surface'`), flight, quality, landing, progress, settings and the debug handle. A third mode (mini-game, hangar) has no clean place to go.
* **Medium.** One bad question in `quizzes.json` makes the loader reject the whole file, so every world loses its quiz (`src/main.ts:56`, `src/data/quizzes.ts`). This gets riskier as content grows to 10 worlds.
* **Low.** `?debug=0` also turns the debug handle on (`params.has('debug')`, `src/main.ts:68`), and the handle ships in production builds.

## 2. Three.js rendering and scene management

**Today.** About 20 draw calls: 10 spheres at 48 x 32 segments (about 30,000 triangles in all), 3 glow sprites, Saturn's ring, one star `Points`, 5 ship meshes. One `WebGLRenderer` is shared with the landing pictures. While a photo is up, space is not drawn.

**Strengths.** Very light scene, so there is real room for a richer look. Landing pictures, stale loads and the placeholder rocket are all freed properly (`src/surface/panoramaScene.ts:143`, `src/scene/spaceScene.ts:102`). Textures use the right colour space.

**Weaknesses.**
* **Medium.** No handling of a lost WebGL context anywhere in `src/`. On a low-memory device a big texture upload is the classic trigger, and the game would just go black.
* **Medium (for 2.0).** Flat lighting: strong ambient light plus a point light with no falloff (`src/scene/spaceScene.ts:75`), strong emissive materials, no environment map, no tone mapping. It is deliberate (night sides stay readable), but it is the main reason the scene looks flat.
* **Low.** Saturn's ring is one flat unlit colour (`src/scene/spaceScene.ts:231`); atmospheres are additive sprites, not shells; stars are all the same 2 px point; planet textures are 256 x 128 generated canvases (`src/scene/textures.ts:4`).
* **Low.** The `shadows` quality flag does nothing: no shadow map is ever turned on.

## 3. Blender models and assets

| Asset | Size | Content | Used? |
| --- | --- | --- | --- |
| `public/models/ship.glb` | 37 KB | 5 meshes, 1,782 triangles, 5 flat materials (`Hull`, `Trim`, `Window`, `Dark`, `Flame`) | Yes. Loaded after the first frame; the placeholder stays if it fails |
| `public/models/orbit.glb` | 57 KB | 9 meshes, 2,144 triangles, 4 face meshes | **No.** Only a test reads it; Orbit is three 192 px PNG portraits |
| Mars panorama | 795 KB / 243 KB | 4096 x 2048 / 2048 x 1024 | Yes (high / low) |
| Earth window photo | 2.5 MB / 547 KB | 4096 x 2730 / 2048 x 1365 | Yes (high / low) |
| `assets-src/ship.blend`, `orbit.blend` | 332 KB, 384 KB | Blender sources (not opened) | Source only |

**Strengths.** Small, well-named models; sizes and licences match `CREDITS.md`; the ship's `Trim` material is ready to be recoloured for customization; first download is only about 0.76 MB.

**Weaknesses.**
* **Medium.** Still missing for 2.0 (`ASSETS.md`): astronaut (needed for outfits), rover, asteroids, real planet textures, sound.
* **Low.** Orbit's 3D model (57 KB) ships in every build and is never shown.
* **Low.** The 4096 Earth photo is wider than any screen it is shown on (the window view spreads the whole photo across the screen width), so 2048 is enough there.

## 4. Rocket movement and flight physics

**Today.** `stepFlight` (`src/flight/flightModel.ts`) is a pure function. Cruise 40 units/s, boost 160, eased. Turn up to 1.6 rad/s (yaw) and 1.2 rad/s (pitch), no roll, the nose levels itself. With a destination, a pull steers toward it at 50% when you let go and 0% at full stick while far away, rising to 100% close in. Speed is capped near the target, and docking at 1.8 radii cannot fail. Other worlds are obstacles: the ship is put back on a shell at 1.1 radii and slides along it.

**Strengths.** Pure, deterministic and tested like a property (about 50 tests with seeded random starts, speeds, frame rates and stick positions). Docking that cannot fail is exactly right for the "no failure" rule. `FlightConfig` is a parameter, so a harder "challenge" tuning needs no new code.

**Weaknesses.**
* **High (gameplay).** Steering never changes the outcome. With no input at all the pull docks every time (`tests/flightModel.test.ts:125`); autopilot only adds boost. Steering can only make a trip longer.
* **Medium (blocks action).** Hitting an obstacle returns nothing: no contact, no bounce, no slow-down (`src/flight/flightModel.ts:123`). The "bump = bounce + a few seconds" rule cannot be built on it yet.
* **Medium (blocks action at scale).** The sub-step count comes from the smallest obstacle anywhere and every body is checked every step (`src/flight/flightModel.ts:127`). With 200 asteroids that is up to 64 x 200 checks per frame.
* **Low.** The pull aims straight through other worlds; 5 of 90 trips slide along a world on the way (all still dock).

## 5. Planet navigation and landing

**Today.** "Where to?" opens the picker. The trip is worked out for the readout, the kid optionally taps Autopilot, docking fires once, and then Earth and Mars open their photos while the other 8 worlds show a card. "Back to space" / "Fly again" turns the rocket away from the world. Autopilot trips take 3-63 s (Earth to Mars about 11 s, Earth to Neptune 46 s); without boost, up to about 3 minutes.

**Strengths.** The landing flow is robust: a picture that finishes loading after the kid has left is thrown away, and quick leave-and-land-again cannot break a visit. Look-around maths is exact for window views, and Tab swings the view to dots behind you. There is an off-screen pointer arrow to the target and a live region that announces destination changes.

**Weaknesses.**
* **High.** 8 of 10 worlds end on "You landed on The Sun! … Fact cards and missions are coming soon." (`src/ui/hud.ts:73`). "Landed" on the Sun and on gas giants is wrong for a science game, and the Mars quiz teaser sends kids to Jupiter, one of these dead ends.
* **High (teaching).** The "pretend speed" is always far faster than light: about 5.8 million km/s on the way to Saturn (about 19 times light speed), right under "Light needs 9.4 seconds to get there". Kids can come away thinking a rocket outruns light. The HUD's small "Real rockets are much slower!" note does not undo that.
* **Low.** The landing card is a `role="dialog"` with no Tab trap or Escape, unlike every other panel (`src/ui/hud.ts:70`).
* **Low.** Without a target a kid can drift into empty space: free flight has no bounds, and name tags hide beyond 2,500 units.

## 6. Missions, quizzes and educational content

| World | Landing | Dots | Mission | Quiz |
| --- | --- | --- | --- | --- |
| Earth | ISS window photo | 6 | Find 3 of 6 | 3 questions |
| Mars | Perseverance 360 degree panorama | 5 | Find 3 of 5 | 3 questions |
| Sun, Mercury, Venus, Moon, Jupiter, Saturn, Uranus, Neptune | "Coming soon" card | 0 | none | none |

In all: 11 fact cards, 6 questions, 6 stars.

**Strengths.** Content is checked by code. Every answer must be backed by its dot's own words, wrong answers must add something the dot does not say, and every dot has dated NASA links (`src/data/quizzes.ts`). Fact cards are 24-33 words at roughly a grade 1-7 reading level (middle about grade 5), with a warm tone. The quiz is gentle: unlimited tries, a word and a mark for wrong answers (not only colour), and a hint that names the dot with the answer.

**Weaknesses.**
* **Medium.** The same 3 questions in the same order with the answers in the same places on every replay. The bonus star on "Play again" can be earned from memory.
* **Medium.** Content that is checked but never shown: each world's `hook` fact, moon counts and orbit days in `planets.json`, and `teaserWorld` in `missions.json`. This is ready-made material for the 8 empty worlds.
* **Medium.** Orbit's hints, the mission line and the "N more to find" lines cannot be read aloud; only fact cards and the quiz have Listen. That is hard on weaker readers.
* **Low.** Mixed units: miles for the space station ("269 miles"), km and °C everywhere else.

## 7. Game state and progression

**Today.** `rocketpals.progress` in `localStorage`: three yes/no flags per world (mission, quiz, perfect quiz). Stars = the number of flags, so they can only go up. Every save reads and merges what is stored first (PR #14), so a second window can never lower stars.

**Strengths.** Can never lose stars; works with storage blocked or full of garbage; tested in the browser with two real windows.

**Weaknesses.**
* **High (before any new saved data).** The save writes `version: 1` but never reads it, and unknown fields are dropped when loading (`src/core/progress.ts:65`). Because every save rewrites the whole record, an old tab still open after an update would wipe every 2.0 field the moment it earns a star.
* **High (design).** The merge ORs yes/no flags. That cannot hold a chosen item (needs "newest wins"), counters, or anything you spend (a merge would bring spent stars back).
* **Medium.** No long-term goal: no total, no ranks, no collection, stars not shown in the world picker or the flying HUD. Found dots are forgotten on each visit.
* **Low.** Progress is loaded once, so stars earned in another window are not shown until this window earns something itself.

## 8. Audio and animation

**Today.** Read-aloud only (`src/audio/speech.ts`): prefers a voice on the device, honest message if there is none, nothing sent anywhere. Howler is in `package.json` but never imported: no music, no effects. Animation: the pulsing dot (`spot-pulse`, 1.6 s), an 80 ms press on big buttons, spinning planets, a flickering flame that follows speed, the easing chase camera, the look view swinging to a dot. Orbit never moves.

**Strengths.** Reduced motion is honoured everywhere: a global CSS rule, planet spin and flame stop, the camera follows tightly, the look view jumps instead of swinging, and the game follows the computer's setting live.

**Weaknesses.**
* **Medium.** Silence: no feedback sound for boost, docking, finding a dot, a right answer or a star. Sound is one of the cheapest ways to make a kids' game feel alive.
* **Medium (for 2.0).** Almost no UI motion: panels and cards appear instantly, stars do not celebrate, Orbit is a still picture.
* **Low.** `howler` and `@types/howler` are unused dependencies.

## 9. Mobile and desktop controls

**Today.** Keyboard (WASD or arrows, Space to boost) and a touch stick with a Boost button. Each finger is tracked on its own, all input is let go when the window loses focus, and browser shortcuts are left alone. The surface view supports drag, swipe, arrows and Tab between dots.

**Strengths.** Careful multi-touch, focus handling and large targets; the browser tests check small screens at the biggest text size.

**Weaknesses.**
* **Medium.** No mouse, touchpad or gamepad steering. The stick only shows with `?touch=1`, a coarse pointer or after a first touch (`src/main.ts:66`, `src/flight/input.ts:68`), so a Chromebook kid on a touchpad must steer with the keyboard.
* **Medium.** The touch stick is fixed at the bottom left (150 px, 120 px on short screens) and a drag must start on it; a thumb that lands a little off does nothing.
* **Low.** W/Up means "nose up", but many kids expect W to mean "go". After pressing Enter on Autopilot, focus stays on it, so the next Space turns autopilot off instead of boosting.

## 10. Testing and performance

**Testing today.** 277 Vitest tests on the pure modules and data checks; 136 Playwright tests in headless Chromium with software WebGL. They cover flying, both landings, missions and quizzes, settings, the ship model, small screens at the biggest text size, blocked storage, slow loads, read-aloud edge cases, privacy (nothing leaves the page) and pixel checks that each dot sits on what it describes.

**Weaknesses (testing).**
* **High.** No CI. Tests only run on someone's machine, which is how PR #12 reached `dev` without its review fixes.
* **Medium.** `Game`, the HUDs, the quiz panel, input and speech have no unit tests, only browser tests. `speech.ts` already accepts a fake synth and could be unit-tested cheaply.
* **Medium.** 30 fixed `waitForTimeout` sleeps and one real autopilot flight with a 180 s timeout make the suite slower and more fragile; 8 slow Earth-window tests are set aside (product owner's decision, 2026-10-23).
* **Low.** No bundle-size, memory or disposal checks.

**Performance today.** About 0.76 MB before play (646 KB JS, mostly Three.js, which tree-shakes well); landing photos load only on landing; quality drops to low when the median frame rate falls below 40 fps and never flips back.

**Weaknesses (performance).**
* **High.** Never measured on a real Chromebook (frame rate, memory, voice).
* **Medium.** Low quality leaves the biggest costs in place. Antialiasing is fixed when the renderer is created (`src/scene/spaceScene.ts:65`), so a device that drops to low keeps it. High allows twice the pixel density, which is 4 times the pixels. A typical 4 GB, 4-core Chromebook starts on high (`src/quality/quality.ts:23`).
* **Medium.** The 4096 photos cost about 45 MB (Mars) and 60 MB (Earth) of video memory, and are decoded and uploaded in one go on the main thread. Expect a visible freeze on landing on a Chromebook (estimate, not measured).
* **Low.** About 40 short-lived objects are made per frame, and a few HUD values are rewritten even when unchanged. These cause small garbage-collection pauses, not a frame-rate problem.
* **Low.** A browser held to 30 Hz is pushed to low quality whatever its GPU can do (the threshold is 40 fps).

---

## Gameplay audit

### What makes it fun today
* **Real places.** Standing inside a real Perseverance panorama or looking out of the space station window is genuinely special, and kids can tell it is real.
* **Discovery.** Glowing dots to find, a tick when found, Orbit getting happy and counting down "N more to discover".
* **Flying feels good.** The chase camera, the boost flame and the slow-down on arrival, with no way to crash or fail.
* **Real scale.** "Light needs 9 seconds to get there" is a great teaching hook.
* **Kind quizzes.** Unlimited tries, a hint, and two of three stars just for finishing.

### What feels repetitive or passive
* **Flights are waiting.** 10-60 s on autopilot (up to 3 minutes by hand) with nothing to do, dodge or collect, and steering that never matters.
* **Same quiz every time,** with the answers in the same places.
* **Same visit every time.** Found dots reset; once a world has 3 stars there is nothing new to do.
* **8 dead ends.** Most destinations end on the same "coming soon" card.

### What is missing from the loop
* A reason to pick the next world (the teaser exists but often points at a dead end).
* Anything to do on the way.
* A visible long-term goal: a total, ranks, a collection, a place where stars are shown off.
* Something to spend progress on (customization).
* Sound, and celebration when something is earned.

### Where action fits
Each idea reuses what is already there. All follow the 2.0 rules: no countdowns, and bumping never fails a run.
1. **Flights with something to do.** Ring gates and fact capsules along the route of a normal trip. Collect them for a fact or a sticker. Passing through a gate needs a small "checkpoint" addition to the flight model; capsules reuse the fact card and Listen.
2. **Asteroid course** (the first mini-game). Seeded asteroids as obstacles, drawn as one instanced mesh; bumping bounces the rocket and adds 2 s to a stopwatch; "beat your best time". Needs contacts from `stepFlight`, a spatial grid, and the screen manager.
3. **Skill that matters, gently.** In challenges, a weaker pull (`FlightConfig.assistBase` around 0.15). Normal trips keep the strong assists, so no kid gets stuck.
4. **Rescue missions.** A stranded pal or probe near a world is a docking target (docking already cannot fail), then you fly them home. Mission text fits `missions.json`.
5. **Timed runs between worlds.** A "how fast can you get to Mars?" stopwatch with a personal best, stored with the same "only goes up" merge.

### Where education could be more engaging
* **Photo detective.** Orbit names something ("Find the rover!") and the kid taps where it is in the photo: the reverse of tap-a-dot, with a hint on a wrong tap.
* **Question pools.** Shuffle questions and answer order each time, so the bonus star is earned, not remembered.
* **Fix the speed lesson.** Say plainly that this rocket is pretend and faster than light, and add "a real rocket would take..." (for example, New Horizons took 9.5 years to reach Pluto).
* **Scale toys.** "How many Earths fit across Jupiter?", "Your weight on the Moon", put the planets in order of size. Show the answer and never score it.
* **Wake the empty worlds now.** Each world's `hook` fact as a fact card, plus a real spacecraft photo as a fly-by view (Juno, Cassini, Voyager, Solar Dynamics Observatory) and a one-question "postcard". No "landing" on the Sun or gas giants: "You are flying past Jupiter".
* **Listen everywhere.** Orbit's hints and the mission line can be read aloud too.

### What would make kids come back
* **Visible progress.** Stars in the world picker and the HUD, a total, and pilot ranks from total stars (ranks only go up).
* **A hangar.** Rocket trims, decals and later outfits, each with its condition shown ("2 stars on Mars unlocks Rover Red"). Unlocks are worked out from what the kid has earned, not a currency to spend, so nothing can be lost, ground for or broken by a merge.
* **Gear with meaning.** A heat-shield decal after Venus, a radio dish after a light-time challenge. Each one ties to a fact.
* **Space Journal / sticker book.** Every fact found, remembered between visits, with a sticker per world.
* **Personal bests** in action games.
* **New things to find.** More worlds, more dots and new missions over time.

---

## Existing features worth preserving
1. The pure, deterministic, heavily tested flight model with docking that cannot fail.
2. The split between pure logic and rendering, and the test seams that come with it.
3. Content in JSON, checked by code against dated NASA sources, with quiz answers backed by the dots.
4. Real NASA photos on landing, and the careful look-around and dot placement.
5. The kind quiz design: unlimited tries, word-and-mark feedback, hints, stars that only go up.
6. Saved progress that can never lose stars, works with storage blocked, and merges across windows.
7. Accessibility already built in: keyboard and touch, big targets, text size, read-aloud, reduced motion followed live, focus traps, live regions.
8. Privacy: nothing leaves the page, and a test proves it.
9. A light scene, lazy loading and clean freeing of memory.
10. The browser test suite, especially the small-screen, broken-data and read-aloud cases.
11. The process: one plan per feature, the decision log, a reviewer on every PR.

## Technical weaknesses (most important first)
1. No CI. *(High)*
2. Never measured on a Chromebook. *(High)*
3. Saved progress ignores its version and drops unknown fields, so 2.0 data could be wiped by an old tab. *(High)*
4. The merge cannot handle choices, counters or spending. *(High, design)*
5. The flight model cannot report contacts or bounce, and does not scale to many obstacles. *(Medium, blocks action)*
6. `Game` does everything; no place for new screens. *(Medium)*
7. Low quality keeps antialiasing and high pixel density; most Chromebooks start on high. *(Medium)*
8. 4096 photos: 45-60 MB of video memory and a freeze on landing. No lost-context handling. *(Medium)*
9. No mouse, touchpad or gamepad steering; a fixed touch stick. *(Medium)*
10. One bad question removes every world's quiz. *(Medium)*
11. UI, controller, input and speech only covered by browser tests; fixed sleeps in the suite. *(Medium)*
12. Flat lighting, no tone mapping, simple ring, atmospheres and stars. *(Medium for 2.0)*
13. Small items: `?debug=0` enables debug, unused Howler, unused Orbit model, the landing card has no focus trap, per-frame allocations, the `shadows` flag does nothing. *(Low)*

## Gameplay weaknesses (most important first)
1. 8 of 10 worlds are dead ends, and "landed on the Sun" is wrong.
2. Steering never matters; flights are waiting.
3. No long-term goal, no visible progress, nothing to unlock.
4. The same quiz every replay; the bonus star can be remembered.
5. The "pretend speed" teaches that rockets outrun light.
6. Only three kinds of interaction: look, tap, multiple choice.
7. No sound and little celebration.
8. Read-aloud does not cover Orbit or the mission line.

## Recommended improvements
* **Safety first:** CI on every PR; a real Chromebook measurement; progress v2 groundwork (read the version, keep unknown fields, a merge that handles choices) before any new saved data ships.
* **Cheap, high-value fixes:** the speed lesson, "flying past" wording for worlds without a surface, a focus trap on the landing card, `?debug=1` only, a load that rejects one bad quiz instead of all of them.
* **Chromebook readiness:** start 4 GB Chromebooks at a lower pixel density, no antialiasing on low, 2048 photos for the Earth window, decode photos off the main thread, recover from a lost context.
* **Foundations for 2.0:** the screen manager; contacts, bounce and a spatial grid in the flight model; an instanced layer for non-planet objects.
* **The loop:** a fact card, fly-by photo and postcard question for every world; gates and capsules on normal flights; the asteroid course; question pools; stars in the picker, a total and ranks.
* **Coming back:** the hangar with earned unlocks (trims first, using the existing `Trim` material); the Space Journal; personal bests.
* **Presentation:** tone mapping, an environment map and rim light first (almost free); real planet textures (KTX2, 1024 for far planets); atmosphere shells and a banded ring; design tokens, then glass panels with a no-blur fallback on low; sound effects, then music; Orbit in 3D.
* **Controls:** mouse and touchpad steering, a floating touch stick, then gamepad.

## Prioritized implementation roadmap

This is a recommendation. It changes the order in `DEVELOPMENT_ROADMAP.md` (it puts making the loop worth playing before the glass look), so it needs the product owner's approval before that file is updated. Each step is its own plan, branch and PR.

| Priority | Step | Why now | Size |
| --- | --- | --- | --- |
| **P0** | 1. Finish PR #14 (two review must-fixes: Shift+Tab leaves the quiz, a stale "Yes! That is right!" on the next question) | It is open and has known bugs | S |
| **P0** | 2. CI: tests and build on every PR | Stops another PR #12 | S |
| **P0** | 3. Measure on a real Chromebook (frame rate, landing freeze, memory, voice) | Every later visual choice depends on it | S (needs a device) |
| **P0** | 4. Progress v2 groundwork: read the version, keep unknown fields, merge rules for choices | Must ship before any new saved data | S |
| **P1** | 5. Quick fixes: speed lesson, "flying past" wording, landing-card focus trap, `?debug=1` only, one bad quiz does not remove all | Small, and two of them teach something wrong today | S |
| **P1** | 6. Chromebook readiness: pixel density and antialiasing on low, 2048 Earth photo, off-thread decode, lost-context recovery | Based on step 3's numbers | M |
| **P1** | 7. Screen manager (needs approval of the design) | Every new screen depends on it | M |
| **P2** | 8. Every world has something: hook fact card, real fly-by photo, postcard question, teaser to a live world | Turns 8 dead ends into destinations; mostly content and licences | M |
| **P2** | 9. Visible progress: stars in the picker and HUD, total, pilot ranks | Cheap, and the first reason to come back | S |
| **P2** | 10. Question pools and shuffled answers | Makes replays and the bonus star real | S |
| **P2** | 11. Flight model contacts, bounce and spatial grid; instanced objects | Needed by every action idea | M |
| **P2** | 12. Things to do on a flight: ring gates and fact capsules | Fills the waiting; uses step 11 | M |
| **P2** | 13. Asteroid course with a stopwatch and personal best | The first action game; uses steps 7 and 11 | L |
| **P3** | 14. Hangar with earned unlocks: rocket trims and decals | Customization pillar; uses steps 4 and 7 | M |
| **P3** | 15. Sound effects (Howler), then music | Cheap life and feedback | M |
| **P3** | 16. Cinematic pass: tone mapping, environment map, rim light, atmospheres, banded ring, real planet textures | Big visual win, measured against step 3 | M |
| **P3** | 17. Design tokens, then glass panels and the cockpit HUD with a no-blur fallback | The visual direction, made safe for Chromebooks | L |
| **P3** | 18. Controls: mouse and touchpad steering, floating touch stick, gamepad | Chromebook touchpads and tablets | M |
| **P4** | 19. Space Journal and sticker book; remember found dots | Collection and coming back | M |
| **P4** | 20. Rescue missions and timed runs between worlds | More action on the same foundations | M |
| **P4** | 21. Full landings for more worlds, starting with the Moon (Apollo panorama) | Content depth | L per world |
| **P4** | 22. Orbit in 3D; astronaut model and outfits | Character and more customization | L |
