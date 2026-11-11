# Rocket Pals: progress

What is done, what is happening now, and what is known to be wrong. Update it with every PR. The plan ahead is in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

Last updated: 2026-11-11.

## Now

* **Game design document:** `docs/GAME_DESIGN.md`, approved on 2026-11-11 with all eight decisions. The Journal, patches and sound effects (#34) moved into the MVP.
* **Technical architecture and milestone roadmap:** approved on 2026-11-11. Every issue under epic #16 now matches a roadmap milestone (GitHub milestones `M0` to `M9`).
* **Quiz bugs from the PR #14 review (#26):** fixed on a branch, waiting for review. Shift+Tab stays inside the quiz, no stale "Yes!", Listen reads the hint, fairer Earth answers.
* **CI (#27):** draft PR #60, waiting for review. After it merges, a person requires the `Tests and build` check on `dev`.
* **Chromebook measurement (#28):** guide ready in `docs/CHROMEBOOK_MEASUREMENT.md`; waiting for a person to measure and fill in the tables below.
* **Next:** #29 (safe saves).

## Health (2026-11-11)

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | 303 passed |
| `npm run test:e2e` (Playwright) | 140 tests: all pass on macOS; in CI 4 are expected failures (Linux font) and 1 is skipped |
| `npm run build` | Clean. 646 KB JavaScript (167 KB gzipped) |
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

## Content coverage

| World | Fly to | Landing picture | Mission and quiz |
| --- | --- | --- | --- |
| Earth | Yes | ISS window view (6 dots) | Yes |
| Mars | Yes | NASA 360 degree panorama (5 dots) | Yes |
| Sun, Mercury, Venus, Moon, Jupiter, Saturn, Uranus, Neptune | Yes | Plain "You landed" card | No |

## Known issues and open items

* **Not measured on a Chromebook yet:** the guide is `docs/CHROMEBOOK_MEASUREMENT.md` (#28) and the numbers are pending. Still unknown: frame rate, the 4096 px panoramas (about 45 MB of video memory; low quality uses 2048 px), and read-aloud with a Chromebook voice.
* **6 slow browser tests** (8 timeouts in a 440-run load test; product owner's decision, 2026-10-23): the Earth-window "never shows empty space beyond the photo at W x H" tests in `e2e/surface-earth.spec.ts` time out under 8-worker load. They passed in all three CI runs on PR #60, so they run in CI. Make them cheaper later; do not delete them.
* **Title card overlaps the buttons without Trebuchet MS** (found by CI, #27). Linux and ChromeOS have no Trebuchet MS; the wider fallback font makes the title card cover Back or Orbit at 844 x 390 with the biggest text and at 320 x 568 with normal text. Kids on Chromebooks probably see this. Four tests are marked `test.fail()` on Linux (`e2e/known-issues.ts`); follow-up issue to add.
* **Orbit second-landing test is timing-dependent** (found by CI, #27): on a slow runner the cached photo loads before the test sees "loading". The game is fine. Skipped in CI only; follow-up issue to add.
* **"Every dot can be found" tests flake in CI** (#27): the 5 s wait for the look to stop turning runs out under load. The ultra-wide mouse test flaked in 2 of 4 CI runs on PR #60; the 2560 x 1080 and 1920 x 700 tests flaked in 1. All passed on retry, so the check stayed green. Worth a follow-up if it keeps happening.
* A dot drawn over the **Quiz time** button can take the tap (keyboard and the uncovered part of the button still work).
* The Jupiter teaser at the end of a quiz leads to a world with no landing yet.
* On a 667 x 375 landscape phone with the biggest text, the Earth title card is too tall for the screen.
* The Orbit 3D model is built but only shown as 2D portraits.
* Planets use generated textures; real ones are listed in `ASSETS.md`.
* Asking NASA before anything goes to `main` is still an open item for a person (see `CREDITS.md`).
