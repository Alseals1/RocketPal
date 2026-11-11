# Rocket Pals: development roadmap

The plan for the whole game, milestone by milestone. Each milestone gets its own plan in `plans/<feature-name>.md`, its own branch and PR into `dev`, and the product owner's approval before major architectural changes. What is done and what is happening now is in [PROGRESS.md](PROGRESS.md).

**Proposed revision:** [PROJECT_AUDIT.md](PROJECT_AUDIT.md) (2026-11-11) recommends a new order, putting the gameplay loop before the glass look. This table changes once the product owner approves it.

Related: [GAME_DESIGN.md](GAME_DESIGN.md) (what the game is), [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) (how the code is built), [VISUAL_DESIGN.md](VISUAL_DESIGN.md) (how it looks).

## Rocket Pal 2.0 milestones

Started 2026-11-11. The goal is a polished game on four pillars: fun, education, action and customization (see `GAME_DESIGN.md`).

| # | Milestone | What | Status |
| --- | --- | --- | --- |
| 0 | Rescue and safety net | Land the missions-and-quiz review fixes that PR #12 merged without. Add CI that runs the tests and the build on every PR. | Fixes in a PR; CI not started |
| 1 | Design docs | These five docs, and the 2.0 rules (`decisions/2026-11-11-rocket-pal-2-game-rules.md`). Docs only. | In a PR |
| 2 | Screen manager | Split `src/game.ts` so each screen (space, surface, later mini-games and the hangar) is its own part with enter, update and leave. No change in behaviour; the existing tests prove it. **Needs the product owner's approval of the design first.** | Not started |
| 3 | Glass look and cockpit HUD | A design system of glass panels with a plain fallback for low quality, tried first on the flying HUD. Frame rate measured on a real Chromebook. | Not started |
| 4 | First action mini-game | An asteroid course using the flight model's obstacles. Stopwatch with a personal best; bumping bounces, never fails. | Not started |
| 5 | Progress v2 and the hangar | Saved progress grows to hold unlocks, with an upgrade path that never loses a kid's stars. A hangar to spend stars on rocket trims (the ship model has a recolourable `Trim` material). | Not started |
| 6 | Sound | Music loops and gentle effects (Howler is installed but unused). | Not started |
| 7 | More worlds | Landing pictures, missions and quizzes for the other eight worlds, starting with the Moon. | Not started |

Later candidates, not yet ordered: rescue missions, the Space Journal and badges, pilot ranks from total stars, astronaut outfits and equipment (needs the astronaut model), stars in the world picker, a "start over" button for shared computers (deletes data: ask the product owner first).

## Rocket Pals 1.0 (2026-10-23 to 2026-11-03)

The first roadmap had five phases. Phases 1 and 2 are done for Earth and Mars, and phase 3 is partly done.

1. **Fly**: solar system scene, star field, ship controls (keyboard and touch), HUD readout, quality mode. **Done.**
2. **Land and learn**: landing, hotspots, fact cards from JSON, Orbit the guide. **Done for Earth and Mars.**
3. **Play**: missions, quizzes, stars, badges, Space Journal for all ten worlds. **Missions, quizzes and stars done for Earth and Mars.**
4. **Mini-games and sound**: five mini-games, music, effects, read-aloud. **Read-aloud done.**
5. **Polish and test**: custom models, performance tuning, accessibility, playtest notes. **Ship and Orbit models done.**

### Decisions made with the user in 1.0

| Topic | Decision |
| --- | --- |
| Scale | Compressed scene (any world reachable in about 20-60 s) with a HUD that shows the **real** distance, a "real speed" number, and a light-speed comparison. |
| Steering | **Full 3D free flight** (pitch, yaw, boost). Because this is hard for ages 8-10, especially on touch, the flight model has strong assists: auto-level (no roll), a soft pull toward the selected destination, slow-down and alignment near a world, and docking that cannot fail. |
| Test seams | (1) flight model, (2) scale/readout formatting, (3) quality-mode chooser, (4) data validation. Rendering is covered by Playwright browser tests. |

### Skills and tools used across the project

`tdd` (game logic), `frontend-design` (HUD, menus, fact cards), `animation-performance` (smooth on a Chromebook), `grill-me` (plan check), and the `pr-reviewer` agent on every PR. Blender MCP for models (see `README.md` to connect it). Assets still needed are in `ASSETS.md`.
