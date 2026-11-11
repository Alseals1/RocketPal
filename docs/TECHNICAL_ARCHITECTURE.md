# Rocket Pals: technical architecture

How the code is built today, and the changes proposed for 2.0. Proposed changes are marked **Proposed** and need the product owner's approval before they are built.

## Constraints

* Three.js, TypeScript and Vite. A static site: no backend, no accounts, nothing sent anywhere.
* Progress and settings live in `localStorage` only, and the game still works when the browser will not save.
* Content lives in `public/data/*.json` so it can be edited without code.
* 30+ fps on a school Chromebook, under 15 MB to first play, with an automatic low-quality mode.

## How it starts

`src/main.ts` checks for WebGL, applies the saved text size and motion setting before anything is drawn, then loads `planets.json`. Landing pictures (`surfaces.json`), missions and quizzes load next. Each is optional: if one fails, the game still flies and lands without it. Then it creates the `Game`. The ship model is loaded later (`import('./scene/shipModel')`), and simple shapes stand in until it arrives.

## Modules

| Folder | What it does | Pure (no DOM or WebGL)? |
| --- | --- | --- |
| `src/flight/` | `flightModel.ts`: one step of flight (speed, turning, auto-level, pull to the target, slow-down, docking that cannot fail, staying out of other worlds). `input.ts`: keyboard and touch to `FlightInput`. | Flight model: yes |
| `src/scale/` | Real distances, light travel time, the "pretend speed", and how a trip in the shrunk scene maps to real kilometres. | Yes |
| `src/quality/` | Picks low or high quality from hardware hints, then drops to low if frame times are slow (median below 40 fps). Once low, it stays low. | Yes |
| `src/quiz/` | A quiz run: check an answer, wrong answers never end it, the first-try bonus. | Yes |
| `src/core/` | `progress.ts`: saved stars (flags per world, so they can only go up; merges with what is stored before saving). `settings.ts`: text size and reduced motion. | Yes |
| `src/data/` | Loaders and validators for the JSON files. The validators are strict, for example every quiz answer must be backed by its dot's words. | Yes |
| `src/scene/` | `spaceScene.ts`: the Three.js renderer, camera, worlds, star field, glows, the ship. `layout.ts` places the worlds in the shrunk scene. `textures.ts` makes the generated planet textures. | No |
| `src/surface/` | `panoramaScene.ts`: draws a landing picture as a sphere (Mars) or a window view (Earth), reusing the space scene's renderer. `look.ts`: drag to look around. `geometry.ts`: the maths for both, tested. | Geometry: yes |
| `src/ui/` | HTML and CSS on top of the canvas: flying HUD, landing HUD (dots, fact card, Orbit, mission line), quiz card, settings panel. | No |
| `src/audio/` | `speech.ts`: read-aloud with the browser's speech voices, and an honest message when there is no voice. | No |
| `src/game.ts` | The controller. See below. | No |

## The game controller

`src/game.ts` (about 500 lines) owns everything that runs: the frame loop (`requestAnimationFrame`, one `tick` per frame, an error in one frame is reported once and the game keeps going), the two modes (`'space'` and `'surface'`), the ship state, the chosen destination and autopilot, the quality check, loading and leaving landing pictures, progress and stars, settings, and the debug handle (`?debug=1` adds `window.rocketPals` for the browser tests).

That works for two screens. 2.0 adds mini-games, a hangar and a cockpit view. Adding each as another branch inside `Game` would make it hard to change safely.

### Proposed: a screen manager (#32)

Each screen becomes its own class with the same small interface:

```ts
interface Screen {
  enter(from: ScreenId): void | Promise<void>;
  update(dt: number, now: number): void;   // called every frame while active
  resize(width: number, height: number): void;
  leave(): void;                            // stop listening, free textures
}
```

`Game` keeps what is shared: the renderer, the frame loop, quality, settings, progress and speech. It hands each frame to the active screen. `SpaceScreen` and `SurfaceScreen` take today's code out of `Game` unchanged. New screens (an asteroid course, the hangar) plug in the same way.

* **Why:** each screen can be built and tested on its own, a screen frees its own memory when it is left (important on a Chromebook), and `Game` stops growing.
* **How it is proven safe:** behaviour does not change. All 277 unit tests and 136 browser tests must pass before and after, and the debug handle keeps its shape.
* **Alternatives:** keep adding modes to `Game` (cheapest now, costly later); or a full engine or state library (more than the game needs, and a new dependency).

### Proposed: progress v2 (#29, then #20)

Saved progress today is `{ version, worlds: { [id]: { missionDone, quizDone, perfectQuiz } } }` under `rocketpals.progress`. Unlocks need more: which trims, outfits and equipment are unlocked, and which are in use. The plan is a version 2 shape with a tested upgrade from version 1 that keeps every star. Unlocks follow the same rule as stars: a merge keeps anything either copy has unlocked, so nothing is ever lost.

## Rendering and performance

* One `WebGLRenderer`, shared by the space scene and the landing pictures.
* Quality switches glow sprites, shadows, star count (2,500 or 600) and the pixel ratio cap (2 or 1). Landing pictures load the 4096 px version on high and 2048 px on low, only after landing.
* The quality level is not visible to CSS today (reduced motion is, as `data-reduced-motion` on `<html>`). The glass look needs a page-level quality flag so CSS can drop the blur on low.
* Build: 646 KB JavaScript, 167 KB gzipped, mostly Three.js, plus a 46 KB chunk for the ship model loader.
* Not yet measured on a real Chromebook.

## Testing

* **Vitest** (`tests/`, 277 tests): every pure module above, and the JSON validators run against the real data files.
* **Playwright** (`e2e/`, 136 tests): headless Chromium with software WebGL against `npm run build && npm run preview` on port 4173. Flying, landing on Earth and Mars, missions and quizzes, settings, the ship model, small screens with the biggest text, blocked storage, slow loads, read-aloud edge cases.
* Run `npm test`, `npm run build` and `npm run test:e2e` before every push. There is no CI yet (#27).
