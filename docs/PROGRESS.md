# Rocket Pals: progress

What is done, what is happening now, and what is known to be wrong. Update it with every PR. The plan ahead is in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

Last updated: 2026-11-12.

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

## Health (2026-11-11)

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | 404 passed |
| `npm run test:e2e` (Playwright) | 155 tests: all pass on macOS; in CI 4 are expected failures (Linux font) and 1 is skipped |
| `npm run build` | Clean. 652 KB JavaScript (168 KB gzipped) |
| CI | GitHub Actions `Tests and build` on PRs into `dev` and pushes to `dev`, about 5-7 minutes (#27). First play 758 kB of the 15 MB budget |
| Chromebook | Not measured yet. Guide ready (#28) |

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

* **Not measured on a Chromebook yet:** the guide is `docs/CHROMEBOOK_MEASUREMENT.md` (#28) and the numbers are pending. Still unknown: frame rate, the 4096 px panoramas (about 45 MB of video memory; low quality uses 2048 px), and read-aloud with a Chromebook voice.
* **6 slow browser tests** (8 timeouts in a 440-run load test; product owner's decision, 2026-10-23): the Earth-window "never shows empty space beyond the photo at W x H" tests in `e2e/surface-earth.spec.ts` time out under 8-worker load. They passed in all three CI runs on PR #60, so they run in CI. Make them cheaper later; do not delete them.
* **Title card overlaps the buttons without Trebuchet MS** (found by CI, #27). Linux and ChromeOS have no Trebuchet MS; the wider fallback font makes the title card cover Back or Orbit at 844 x 390 with the biggest text and at 320 x 568 with normal text. Kids on Chromebooks probably see this. Four tests are marked `test.fail()` on Linux (`e2e/known-issues.ts`); follow-up issue to add.
* **Orbit second-landing test is timing-dependent** (found by CI, #27): on a slow runner the cached photo loads before the test sees "loading". The game is fine. Skipped in CI only; follow-up issue to add.
* **"Every dot can be found" tests flake in CI** (#27): the 5 s wait for the look to stop turning runs out under load. The ultra-wide mouse test flaked in 2 of 4 CI runs on PR #60; the 2560 x 1080 and 1920 x 700 tests flaked in 1. All passed on retry, so the check stayed green. Worth a follow-up if it keeps happening.
* **Stats card reaches the Autopilot button on a 390 x 844 phone with the biggest text** (found while building #30). The card is narrow there (about 120 px of text), so every line wraps. It already overlapped by 7 px before #30; the "pretend rocket" line makes it about 85 px. The New Horizons line is hidden on phones and short screens to keep 420 x 900 and 844 x 390 clear. The card ignores taps, so the button still works. Needs a phone layout for the stats card; follow-up issue to add.
* A dot drawn over the **Quiz time** button can take the tap (keyboard and the uncovered part of the button still work).
* The Jupiter teaser at the end of a quiz leads to a world with no landing yet.
* On a 667 x 375 landscape phone with the biggest text, the Earth title card is too tall for the screen.
* The Orbit 3D model is built but only shown as 2D portraits.
* Planets use generated textures; real ones are listed in `ASSETS.md`.
* Asking NASA before anything goes to `main` is still an open item for a person (see `CREDITS.md`).
