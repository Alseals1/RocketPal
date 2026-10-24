# Rocket Pals: roadmap and project layout

Audience: ages 8-10. Healthy engagement only (see `CLAUDE.md` product rules).

## Decisions made with the user

| Topic | Decision |
| --- | --- |
| Scale | Compressed scene (any world reachable in about 20-60 s) with a HUD that shows the **real** distance, a "real speed" number, and a light-speed comparison. |
| Steering | **Full 3D free flight** (pitch, yaw, boost). Because this is hard for ages 8-10, especially on touch, the flight model has strong assists: auto-level (no roll), a soft pull toward the selected destination, slow-down and alignment near a world, and docking that cannot fail. |
| Phase 1 test seams (agreed) | (1) flight model, (2) scale/readout formatting, (3) quality-mode chooser, (4) `planets.json` validation. Rendering is covered by one Playwright smoke test. |

## Phases

1. **Fly**: solar system scene, star field, ship controls (keyboard + touch), HUD readout, quality mode.
2. **Land and learn**: landing, hotspots, fact cards from JSON, Orbit guide. Earth and Mars end to end.
3. **Play**: missions, quizzes, stars, badges, Space Journal for all ten worlds.
4. **Mini-games and sound**: five mini-games, music, effects, read-aloud.
5. **Polish and test**: custom models, performance tuning, accessibility, playtest notes.

### Phase 1 features (each = its own branch, plan, PR, review)

| Order | Branch | What |
| --- | --- | --- |
| 1 | `feature/project-setup` | Vite + TS + Vitest + Playwright scaffold, folder layout, CI-less `npm test` / `npm run build`, `ASSETS.md`, `CREDITS.md`, README. Blank page that loads with no errors. |
| 2 | `feature/planet-data` | `public/data/planets.json` (10 worlds, `lastChecked`, moon counts flagged), schema validation test, scale/readout module. |
| 3 | `feature/fly-scene` | Three.js scene, bodies, star field, placeholder ship, flight model + assists, keyboard + touch controls, HUD, quality mode, smoke test. |

## Project layout (target)

```
Rocket Pals/
  CLAUDE.md  ASSETS.md  CREDITS.md  README.md
  plans/                      one plan per feature
  .claude/agents/pr-reviewer.md
  .agents/skills/             tdd, frontend-design, animation-performance, grill-me
  public/
    data/                     planets.json, quizzes.json, missions.json (editable by content team)
    models/                   compressed glTF (ship, rover, astronaut, Orbit, props)
    textures/                 <= 2048 px, lazy-loaded
    audio/
  src/
    main.ts                   boot: pick quality, start game loop
    core/                     game loop, state, save/load (localStorage)
    flight/                   flight model (pure, tested), input mapping, assists
    scene/                    Three.js scene, bodies, starfield, ship, camera
    data/                     JSON loaders + validation
    ui/                       HTML/CSS overlay: HUD, menus, fact cards, journal
    quality/                  fps sampling + low/high quality chooser
  tests/                      Vitest unit tests (mirrors src/)
  e2e/                        Playwright smoke tests
```

## Assets and tools

* **Blender MCP: not available in this Claude Code session** (no Blender tools). Phase 1 uses placeholder shapes. Everything still needed is listed in `ASSETS.md`.
* **Textures:** the web is reachable from this machine, so real textures can be downloaded. Licence of each source is verified before use and recorded in `CREDITS.md`. Until then, procedural textures are used.
* **Connecting Blender MCP to Claude Code:** see the section in `README.md`.

## Skills and tools used across the project

`tdd` (game logic), `frontend-design` (HUD/menus/fact cards), `animation-performance` (smooth on a Chromebook), `grill-me` (plan check; its `grilling` sub-skill is not installed here, so the plan check was done as a direct question round with the user), `pr-reviewer` agent on every PR.

## Follow-ups after missions and quiz (2026-10-23)

* Space Journal and badges (and whether to remember found dots).
* Missions and quizzes for the other eight worlds as their landing pictures arrive (each needs a mission, three questions tied to dots, and a teaser).
* Stars shown in the world picker; pilot ranks from total stars.
* A "start over" button for shared computers (a data-deletion decision: ask the user first).
* Small-screen follow-up: a 667 x 375 landscape phone with the biggest text is too short for the Earth title card.
