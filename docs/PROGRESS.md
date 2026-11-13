# Rocket Pals: progress

What is done, what is happening now, and what is known to be wrong. Update it with every PR. The plan ahead is in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

Last updated: 2026-11-13.

## Now

* **Game design document:** `docs/GAME_DESIGN.md`, approved on 2026-11-11 with all eight decisions. The Journal, patches and sound effects (#34) moved into the MVP.
* **Technical architecture and milestone roadmap:** approved on 2026-11-11. Every issue under epic #16 now matches a roadmap milestone (GitHub milestones `M0` to `M9`).
* **Quiz bugs from the PR #14 review (#26):** fixed on a branch, waiting for review. Shift+Tab stays inside the quiz, no stale "Yes!", Listen reads the hint, fairer Earth answers.
* **CI (#27):** draft PR #60, waiting for review. After it merges, a person requires the `Tests and build` check on `dev`.
* **Chromebook measurement (#28):** guide ready in `docs/CHROMEBOOK_MEASUREMENT.md`; waiting for a person to measure and fill in the tables below.
* **Quick fixes (#30):** draft PR, waiting for review. The stats card says the rocket is pretend ("19 times faster than light! Only a pretend rocket can do that.") and compares with New Horizons (about 9 and a half years to Pluto; hidden on phones, where there is no room). The Sun and the giant planets say "You are flying past …" instead of "You landed on …". The landing card keeps Tab on its button and Escape flies again. Debug mode needs `?debug=1` exactly. One bad quiz now drops only that world's quiz and logs it (`decisions/2026-11-11-quick-fixes-wording-and-quiz-loading.md`).
* **Save v2 (#29):** draft PR, waiting for review. Progress is now saved as a versioned v2 record (`src/core/save/schema.ts`, `src/platform/saveStore.ts`): old v1 saves upgrade with every star, fields from a newer version are kept, every field merges by its own rule, and another window's stars show up without a reload. A copy under `rocketpals.progress.backup` means a tab left open from before the update cannot wipe 2.0 progress (`decisions/2026-11-11-save-v2-format.md`).
* **One content loader (#38):** draft PR, waiting for review. `loadContent()` (`src/data/content.ts`, with the shared ids in `src/data/ids.ts`) replaces the four data loaders: it fetches the four files at once, checks each entry on its own and every cross-reference, and builds the `Content` maps that `Game` now reads. A bad world, landing picture, quiz or mission is left out with the entries that point at it, logged, and listed in `content.problems`; the rest of the game still loads. The game plays as before (`decisions/2026-11-11-content-loader-interim-types.md`).
* **Architecture test (#37):** draft PR, waiting for review. `tests/architecture.test.ts` maps every `src/` file to a layer of `TECHNICAL_ARCHITECTURE.md` section 3, reads its imports, and fails naming the file, the import and the rule. 7 type-only imports that break a rule today sit on a commented allow-list (`data/quizzes` → `quiz`; `scale/leg`, `ui/hud` → `scene/layout`; `ui/hud`, `ui/surfaceHud` → `scene/spaceScene`; `ui/quizPanel`, `ui/surfaceHud` → `audio/speech`), each with what removes it. The list can only shrink: a stale entry fails the test. No `src/` change (`decisions/2026-11-12-architecture-import-rules.md`).
* **Screen split (#32, M1):** parts 2 and 3 had merged into their stack branches, not `dev`; they reach `dev` through #31 part 1 (`goat/31-1-land-32`, draft PR), which also moves #38's `Content` into the split files (`ctx.content`, plus a `layouts` stand-in). `src/game.ts` is split into `SpaceScreen` (flying) and `ArrivalScreen` (standing on a world), behind the `Screen` interface from architecture 4.11, run by a small `ScreenManager` (`src/app/`). `Game` is now a shell of 139 lines in `src/app/game.ts`. Nothing the player sees, hears or saves changed. One fix came with it: leaving a world now frees the surface HUD and its keyboard listeners, which used to stay behind. New tests: `tests/screenManager.test.ts`, `tests/gameShell.test.ts`, `e2e/screens.spec.ts` (listeners and graphics memory after leaving). Scripted play-through in headless Chrome on a Mac (keyboard, touch layout, Mars with dots and quiz, Earth, Jupiter's card): same results as `dev`, 60 fps flying on both, 59 fps on Mars (58 on `dev`) (`decisions/2026-11-11-screen-split.md`).
* **Chromebook readiness and the renderer host (#31, M1):** part 2 (#70) is merged into part 1, so PR #69 now carries both parts and waits for merge into `dev`; the Chromebook numbers and threshold tuning moved to #72 (answer B). Part 1 lands #32 on `dev` (see the screen split). Part 2: `WebRendererHost` (`src/render/rendererHost.ts`) owns the one renderer. Devices with 4 GB or 4 cores or less start on low (defaults until measured), and low means no antialiasing and pixel ratio 1; a run-time drop cuts the pixel ratio at once. `<html data-quality>` follows the quality. Earth's window view always uses the 2048 photo, and photos decode off the main thread (`ImageBitmapLoader`, with a fallback). A lost WebGL context pauses the game behind a kid-friendly notice with "Start again", and the picture comes back on restore (`decisions/2026-11-12-renderer-host-and-quality.md`).
* **Flight events (#49):** draft PR, waiting for review. `stepFlightWithEvents` (`src/flight/flightModel.ts`) reports each step's bumps (`contacts`) and the checkpoints the ship entered (`passed`). `FlightContext` gains `checkpoints` (pass through) and `bounce` (mirror off the rock, speed capped, the bump point the same at any frame rate), and `createObstacleIndex` (`src/flight/obstacleIndex.ts`) keeps a 200-rock course at about 5-26 µs a step. `stepFlight` flies exactly as before; a frozen copy of the old code checks that step by step. Nothing in the game uses it yet: #51 builds the courses (`decisions/2026-11-12-flight-events.md`).
* **Platform services (#41):** draft PR, waiting for review. Settings are now a `SettingsStore` (`src/platform/settingsStore.ts`) over the same `rocketpals.settings` key, saved as version 2 with `volume`, `assist` and `boost`; old settings load unchanged. `createAudioManager` (`src/platform/audio.ts`) has the three channels and loads Howler as its own chunk only on the first tap or key (no sounds yet, #34). `createInputManager` (`src/platform/input/`) replaces `src/flight/input.ts`: the keyboard and touch stick are `InputSource`s, `setSources` replaces the touch suspend, and the action table (M, Escape, Enter, Space) is ready with nothing subscribed. Flying, settings and read-aloud work as before (`decisions/2026-11-12-platform-services.md`).
* **Events, conditions and derived progression (#39, M2):** a stack of 4 draft PRs. Part 1: the event bus (`src/core/events.ts`: `GameEvent`, `EventBus`, `createEventBus`), the `Condition` type and its data check (`src/data/conditions.ts`), and the XP table and 8 ranks in `public/data/progression.json` (`src/data/progression.ts`), loaded as `content.progression`; a missing or broken file gives no XP and the rest still works. Part 2: missions are `MissionDef`s with a `goal` condition (`find-3-mars`, `find-3-earth` in `public/data/missions.json`), `content.missions` is keyed by mission id, and `isMet` / `progressOf` (`src/core/conditions.ts`) answer every condition kind from the save, with a v1 `missionDone` flag still counting as done. Saving still goes through today's code. Part 3: `src/core/progression/` works out XP, rank, stars per place, missions and Journal pages from the save (`deriveProgression`, memoised by save revision), says what changed (`diffProgression`), and holds the pure recorder `record(save, event, content)`, the only code meant to change the save. Playing everything that exists once is 155 XP (rank 2, Junior Pilot). Property tests check that no merge of two saves and no recorded event ever lowers XP, rank, stars, missions or pages. Part 4: the game now runs on it. `SpaceScreen` emits `arrived` on docking and `ArrivalScreen` emits `dotFound` and `quizFinished`; `connectProgression` (`src/app/progression.ts`) subscribes the recorder first, and `ScreenContext` gains `events` and `progression()` (4.11). `src/core/progress.ts` is gone. Stars and missions look the same, with one intended change: dots found on an earlier visit now count towards "find 3". The save now also fills `visited`, `dots`, `quizzes` and `repeats`. There is no new UI yet (`decisions/2026-11-12-events-conditions-progression.md`).
* **Question pools, levels and shuffled answers (#45, M4):** draft PR. Each world's quiz is now a pool of levelled questions in `public/data/quizzes.json` (`pools`, section 4.10): Mars has 8 and Earth 9, at levels 1 to 3, 11 of them new. Every time the quiz opens (Quiz time, Play again, or after Not now) `drawQuestions` (`src/data/quizzes.ts`) picks 3 for the pilot's rank, never two on the same dot (so one cannot give another away), and shuffles them and their answers, and `drawDifferent` makes sure it is never the same as the last go, so the bonus star has to be earned again. Ranks 1-4 get levels 1 and 2; from rank 5 each quiz has exactly one level-3 question. The seed comes from `Math.random()` and only picks questions, never rewards. The loader checks every question on its own: a bad one is left out and the rest of the quiz still loads. `QuizQuestion` moved to `data/`, so the architecture test's `data/quizzes` → `quiz` entry is gone. A person still has to read the new questions against NASA (see open items) (`decisions/2026-11-13-question-pools.md`).
* **Asset manager and manifest (#40, M2):** draft PR, waiting for review. The landing photos and the Blender rocket now load through one ref-counted `AssetManager` (`src/platform/assets.ts`) and a manifest (`src/assets/manifest.ts`) that lists each file's high and low URL, its size and its `CREDITS.md` id (a new Id column). The arrival screen holds its photo only while you stand on the world, the last release frees it on the graphics card, held assets are re-uploaded after a lost context, and a broken file is logged once and falls back as before (plain landing card, simple rocket). The debug handle adds `getHeldAssets()`. The game looks and plays the same (`decisions/2026-11-13-asset-manager.md`).
* **Design tokens, fonts and components (#21, M3):** a stack of 3 draft PRs. Part 1: every `docs/VISUAL_DESIGN.md` section 4 token is in `src/ui/styles/tokens.css`, with the colours also in `src/ui/tokens.ts` for Three.js (the space background now reads it). Fredoka (titles) and Lexend (everything else) are self-hosted Latin-subset WOFF2 files in `public/fonts/` (56 KB together, SIL OFL 1.1, `CREDITS.md`). `src/style.css` now takes every colour from a token; today's values with no exact token are a `--legacy-*` block that M8 deletes, so the screens look the same apart from the fonts. The settings card is only as tall as its content. Unit tests check token parity, WCAG contrast of every text pair (worst case over white and black) and that no other stylesheet holds a colour or font name. Screenshots of today's screens are in `docs/visual-baseline/m3/`. Part 2: a component test page, `gallery/components.html`, built only when `RP_GALLERY=1` (the browser tests set it; the game build never contains it), and the first components in `src/ui/components/` and `src/ui/styles/components.css`: glass panel (hud, card, sheet, dialog), primary, secondary and icon buttons, the focus ring (3 px cyan with a dark gap), segmented control, dialog (traps Tab, Escape closes, focus returns to the opener) and toast (2.5 s, polite live region). Low quality drops the blur and uses the strong fill; reduced motion cuts every transition. The settings panel's arrow keys now share `nextRadioIndex` (`decisions/2026-11-13-design-tokens-and-components.md`).

## Health (2026-11-13)

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | 764 passed (2026-11-13, #45 after merging #21 part 1) |
| `npm run test:e2e` (Playwright) | 178 tests: 174 pass and 4 screenshot-only tests are skipped on macOS (2026-11-13, #45 after merging #21 part 1). The 4 Linux-font expected failures are gone: the game now ships its own fonts |
| `npm run build` | Clean. 679 KB first-load JavaScript (179 KB gzipped); Howler is a separate 36 KB chunk loaded on the first tap or key (#41), and GLTFLoader a separate 45 KB chunk loaded after the first frame (#40) |
| CI | GitHub Actions `Tests and build` on PRs into `dev` and pushes to `dev`, about 5-7 minutes (#27). First play 758 kB of the 15 MB budget |
| Chromebook | Not measured yet. Guide ready (#28) |

## Before and after #31 (same Chromebook)

Pending: a person fills this in on one Chromebook before #31 part 2 merges, following [CHROMEBOOK_MEASUREMENT.md](CHROMEBOOK_MEASUREMENT.md) on each build. "Before" is `dev` with #32 (after #31 part 1, `goat/31-1-land-32`); "after" is the #31 part 2 branch (`goat/31-2-renderer-host`). Never fill a cell with an estimate.

| Item | Before (#31 part 1) | After (#31 part 2) |
| --- | --- | --- |
| Quality picked on `/` (`rocketPals.getQuality()`) | — | — |
| Antialiasing on or off | — | — |
| Pixel ratio used (`canvas.width / canvas.clientWidth`) | — | — |
| Median fps on `/`: idle near Earth | — | — |
| Median fps on `/`: boosting | — | — |
| Median fps on `/`: autopilot to Neptune | — | — |
| Landing freeze on `/`: Mars (ms) | — | — |
| Landing freeze on `/`: Earth (ms) | — | — |
| GPU memory on Earth | — | — |

## Chromebook measurements

Measured by a person with [CHROMEBOOK_MEASUREMENT.md](CHROMEBOOK_MEASUREMENT.md). Empty cells (—) are not measured yet. Never fill a cell with an estimate: write "could not measure: <why>".

**Device**

| Item | Value |
| --- | --- |
| Model | — |
| ChromeOS version | — |
| Chrome version | — |
| Date measured | — |
| Power (charger or battery) | — |
| Served from (address, secure yes/no) | — |
| CPU cores | — |
| Device memory | — |
| Pixel ratio | — |
| Screen | — |
| Max texture size | — |
| GPU | — |
| Touchscreen | — |
| DevTools allowed | — |

**Frame rate (median fps / slow fps / longest ms)**

| Test | Auto (`/`) | `?quality=high` | `?quality=low` |
| --- | --- | --- | --- |
| Idle near Earth | — | — | — |
| Boosting | — | — | — |
| Autopilot to Neptune | — | — | — |

Quality the game picks by itself: —

**Landing freeze (longest frame, ms)**

| World | 4096 photo (`?quality=high`) | 2048 photo (`?quality=low`) | Visible? |
| --- | --- | --- | --- |
| Mars | — | — | — |
| Earth | — | — | — |

**Memory (tab footprint / tab GPU / GPU process, MB)**

| Point | `?quality=high` | `?quality=low` |
| --- | --- | --- |
| In space after loading | — | — |
| On Mars | — | — |
| Back in space after Mars | — | — |
| On Earth | — | — |
| Back in space after Earth | — | — |

**Read-aloud**

| Item | Result |
| --- | --- |
| Voices found | — |
| Listen works | — |
| Time to start (ms) | — |
| Notes | — |

**Touchpad and touch**

| Item | Result |
| --- | --- |
| Steer with touchpad | — |
| On-screen controls appear by themselves | — |
| Buttons easy to hit | — |
| Look around the photo | — |
| Notes | — |

Notes posted on #31: —

## Done

| PR | What |
| --- | --- |
| #1 | Project scaffold: Vite, TypeScript, Vitest, Playwright, `ASSETS.md`, `CREDITS.md` |
| #2 | `planets.json` for 10 worlds, its validator, real-number readouts |
| #3 | Flight model with assists (auto-level, pull to target, docking that cannot fail), quality chooser |
| #4 | Playable flight scene: 3D solar system, keyboard and touch controls, HUD, autopilot |
| #5 | Planet facts updated to current NASA moon counts and wording |
| #6 | Settings: text size and reduced motion, remembered in the browser |
| #7 | Mars landing: a real NASA 360 degree photo with fact dots, Orbit, read-aloud |
| #8 | Follow-ups: licensing record, Listen that recovers, steadier flying tests, Neptune wording |
| #9 | Earth landing: a real ISS astronaut photo seen through a space station window |
| #10 | Rocket ship model built in Blender |
| #11 | Orbit the robot guide built in Blender, shown as portraits on the landing screen |
| #12 | Missions and quiz for Earth and Mars: find 3 things, answer 3 questions, earn up to 3 stars |
| #13 | `CLAUDE.md`: rules for G.O.A.T. AI issues |
| #14 | Missions and quiz: the review fixes PR #12 was merged without (two new bugs from its review are #26) |
| #15 | `docs/`: roadmap, progress, design docs, the 2.0 rules, and the project audit |
| #57 | Quiz fixes: Shift+Tab stays in the quiz, no stale "Yes!", Listen reads the hint, fairer Earth answers |
| #60 | CI: tests, build and browser tests on every PR into `dev`, sizes in the job summary; each checkout gets its own browser-test port (`E2E_PORT` overrides) |
| #61 | Chromebook measurement guide and empty results tables (#28) |
| #62 | Save v2 (#29): versioned save with upgrade from v1, unknown fields kept, a merge rule per field, a backup copy, and live updates from other windows |

## Content coverage

| World | Fly to | Landing picture | Mission and quiz |
| --- | --- | --- | --- |
| Earth | Yes | ISS window view (6 dots) | Yes |
| Mars | Yes | NASA 360 degree panorama (5 dots) | Yes |
| Mercury, Venus, Moon | Yes | Plain "You landed" card | No |
| Sun, Jupiter, Saturn, Uranus, Neptune | Yes | Plain "You are flying past" card | No |

## Known issues and open items

* **CI now runs when a pull request's base changes to `dev`** (2026-11-13, `decisions/2026-11-13-ci-on-retarget.md`). Before this, the upper parts of #39's stack (PRs #75, #76, #77) were re-targeted to `dev` and merged without a pull-request CI run; `dev`'s own CI passed after each merge. G.O.A.T.'s autopilot now waits for these checks.

* **A person reads the 11 new quiz questions against NASA before `dev` → `main`** (#45). Each one restates a fact from a dot whose sources were checked on 2026-10-23, but no person has read the questions yet. Check each against its dot's `sources` in `public/data/surfaces.json`, then update `lastChecked` in `public/data/quizzes.json`. The new ids: `mars-sky`, `mars-sky-color`, `mars-photos`, `mars-lake-age`, `mars-rover-job`, `earth-aurora-oxygen`, `earth-clouds`, `earth-oceans`, `earth-arrays`, `earth-height`, `earth-air-shield`.
* **Not measured on a Chromebook yet:** the guide is `docs/CHROMEBOOK_MEASUREMENT.md` (#28) and the numbers are pending. Still unknown: frame rate, the 4096 px panoramas (about 45 MB of video memory; low quality uses 2048 px), and read-aloud with a Chromebook voice.
* **6 slow browser tests** (8 timeouts in a 440-run load test; product owner's decision, 2026-10-23): the Earth-window "never shows empty space beyond the photo at W x H" tests in `e2e/surface-earth.spec.ts` time out under 8-worker load. They passed in all three CI runs on PR #60, so they run in CI. Make them cheaper later; do not delete them.
* **Orbit second-landing test is timing-dependent** (found by CI, #27): on a slow runner the cached photo loads before the test sees "loading". The game is fine. Skipped in CI only; follow-up issue to add.
* **"Every dot can be found" tests flake in CI** (#27): the 5 s wait for the look to stop turning runs out under load. The ultra-wide mouse test flaked in 2 of 4 CI runs on PR #60; the 2560 x 1080 and 1920 x 700 tests flaked in 1. All passed on retry, so the check stayed green. Worth a follow-up if it keeps happening.
* **Stats card reaches the Autopilot button on a 390 x 844 phone with the biggest text** (found while building #30). The card is narrow there (about 120 px of text), so every line wraps. It already overlapped by 7 px before #30; the "pretend rocket" line makes it about 85 px. The New Horizons line is hidden on phones and short screens to keep 420 x 900 and 844 x 390 clear. The card ignores taps, so the button still works. Needs a phone layout for the stats card; follow-up issue to add.
* A dot drawn over the **Quiz time** button can take the tap (keyboard and the uncovered part of the button still work).
* The Jupiter teaser at the end of a quiz leads to a world with no landing yet.
* On a 667 x 375 landscape phone with the biggest text, the Earth title card is too tall for the screen.
* The Orbit 3D model is built but only shown as 2D portraits.
* Planets use generated textures; real ones are listed in `ASSETS.md`.
* Asking NASA before anything goes to `main` is still an open item for a person (see `CREDITS.md`).
