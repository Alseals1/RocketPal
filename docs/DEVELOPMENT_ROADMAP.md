# Rocket Pals: development roadmap

The plan for the whole game, milestone by milestone. Each milestone gets its own plan in `plans/<feature-name>.md`, its own branch and PR into `dev`, and the product owner's approval before major architectural changes. What is done and what is happening now is in [PROGRESS.md](PROGRESS.md).

Related: [GAME_DESIGN.md](GAME_DESIGN.md) (what the game is), [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) (how the code is built), [VISUAL_DESIGN.md](VISUAL_DESIGN.md) (how it looks).

## Rocket Pal 2.0 roadmap

Started 2026-11-11. The goal is a polished game on four pillars: fun, education, action and customization (see `GAME_DESIGN.md`). This order comes from [PROJECT_AUDIT.md](PROJECT_AUDIT.md) and was **approved by the product owner on 2026-11-11**. It makes the game safe to grow, then makes the loop worth playing, then gives kids reasons to come back, and polishes the look and sound around that.

The work is tracked as GitHub issues under epic #16. The P0 and P1 issues (`prio:first`, `prio:next`) come before the original epic issues #18-#25 (`prio:later`). Each step gets its own plan, branch and PR.

| Priority | Step | Issue | Status |
| --- | --- | --- | --- |
| P0 | 1. Finish PR #14 (two review must-fixes) | #26 | Not started |
| P0 | 2. CI: tests and build on every PR | #27 | Not started |
| P0 | 3. Measure on a real Chromebook (needs a device) | #28 | Not started |
| P0 | 4. Progress v2 groundwork: read the version, keep unknown fields, merge rules | #29 | Not started |
| P1 | 5. Quick fixes: speed lesson, "flying past" wording, landing-card focus trap, debug flag, one bad quiz | #30 | Not started |
| P1 | 6. Chromebook readiness: low quality, photo sizes, off-thread decode, lost-context recovery | #31 | Not started |
| P1 | 7. Screen manager (the design needs approval first) | #32 | Not started |
| P2 | Experience contract: pick the vertical slice, the reward schema, what is deferred (mostly written in these docs) | #18 | Partly done |
| P2 | 8. Every world has something: hook fact card, real fly-by photo, postcard question | #19 | Not started |
| P2 | 9. Visible progress: stars in the picker and HUD, total, pilot ranks | #20 | Not started |
| P2 | 10. Question pools and shuffled answers | #19 | Not started |
| P2 | 11. Flight model contacts, bounce and spatial grid; instanced objects | #19 | Not started |
| P2 | 12. Things to do on a flight: ring gates and fact capsules | #19 | Not started |
| P2 | 13. Asteroid course with a stopwatch and personal best | #19 | Not started |
| P3 | 14. Hangar with earned unlocks: rocket trims and decals | #20 | Not started |
| P3 | 15. Sound effects, then music | No issue yet | Not started |
| P3 | 16. Cinematic pass: tone mapping, lighting, atmospheres, ring, real planet textures | #22 | Not started |
| P3 | 17. Design tokens, then glass panels and the cockpit HUD with a no-blur fallback | #21 | Not started |
| P3 | 18. Controls: mouse and touchpad steering, floating touch stick, gamepad | #24 | Not started |
| P4 | 19. Space Journal and sticker book; remember found dots | #20 | Not started |
| P4 | 20. Rescue missions and timed runs between worlds | No issue yet | Not started |
| P4 | 21. Full landings for more worlds, starting with the Moon | No issue yet | Not started |
| P4 | 22. Orbit in 3D; astronaut model and outfits | #23 | Not started |
| Last | Accessibility and performance pass over the new flows; end-to-end QA and release candidate | #24, #25 | Not started |

Done before this roadmap: the audit (#17, `PROJECT_AUDIT.md`) and these design docs (PR #15).

Later candidates, not yet ordered: a "start over" button for shared computers (deletes data: ask the product owner first).

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
