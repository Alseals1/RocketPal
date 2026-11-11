# Rocket Pals: progress

What is done, what is happening now, and what is known to be wrong. Update it with every PR. The plan ahead is in [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

Last updated: 2026-11-11.

## Now

* **Rescue (#26):** the review fixes for missions and quiz (PR #12 was merged before they were committed) are in PR #14 into `dev`, branch `feature/missions-quiz-review-fixes`. All tests pass; the reviewer asked for two fixes (Shift+Tab leaves the quiz; a stale "Yes! That is right!" can show on the next question).
* **Design docs and audit:** this file and the other docs in `docs/`, in PR #15, branch `feature/project-docs`.
* **Audit:** `docs/PROJECT_AUDIT.md`. Its roadmap was approved on 2026-11-11 and is now `DEVELOPMENT_ROADMAP.md`, tracked as issues #26-#32 (first) and #18-#25 (later) under epic #16.
* **Next:** #26 (finish PR #14), then #27 (CI), #28 (Chromebook measurement) and #29 (safe saves).

## Health (2026-11-11)

| Check | Result |
| --- | --- |
| `npm test` (Vitest) | 277 passed |
| `npm run test:e2e` (Playwright) | 136 passed |
| `npm run build` | Clean. 646 KB JavaScript (167 KB gzipped) |
| CI | None yet. Tests only run on a developer's machine |
| Chromebook | Never measured: frame rate, memory and read-aloud voice |

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

## Content coverage

| World | Fly to | Landing picture | Mission and quiz |
| --- | --- | --- | --- |
| Earth | Yes | ISS window view (6 dots) | Yes |
| Mars | Yes | NASA 360 degree panorama (5 dots) | Yes |
| Sun, Mercury, Venus, Moon, Jupiter, Saturn, Uranus, Neptune | Yes | Plain "You landed" card | No |

## Known issues and open items

* **Not measured on a Chromebook:** frame rate, the 4096 px panoramas (about 45 MB of video memory; low quality uses 2048 px), and read-aloud with a Chromebook voice.
* **8 slow browser tests are set aside** (product owner's decision, 2026-10-23): the Earth-window "never shows empty space beyond the photo at W x H" tests in `e2e/surface-earth.spec.ts` time out under 8-worker load. Make them cheaper; do not delete them.
* A dot drawn over the **Quiz time** button can take the tap (keyboard and the uncovered part of the button still work).
* The Jupiter teaser at the end of a quiz leads to a world with no landing yet.
* On a 667 x 375 landscape phone with the biggest text, the Earth title card is too tall for the screen.
* The Orbit 3D model is built but only shown as 2D portraits.
* Planets use generated textures; real ones are listed in `ASSETS.md`.
* Asking NASA before anything goes to `main` is still an open item for a person (see `CREDITS.md`).
