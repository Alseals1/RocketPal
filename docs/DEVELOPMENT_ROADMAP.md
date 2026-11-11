# Rocket Pals: development roadmap

The plan for Rocket Pal 2.0, milestone by milestone. **Status: approved by the product owner on 2026-11-11**, together with [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md). The work is tracked as GitHub issues under epic #16, grouped by GitHub milestones `M0` to `M9`. It keeps the order approved on 2026-11-11 from [PROJECT_AUDIT.md](PROJECT_AUDIT.md) and the MVP from [GAME_DESIGN.md](GAME_DESIGN.md), grouped into milestones (the step-by-step mapping is at the end).

Related: [GAME_DESIGN.md](GAME_DESIGN.md) (what the game is), [VISUAL_DESIGN.md](VISUAL_DESIGN.md) (how it looks), [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) (how it is built), [PROGRESS.md](PROGRESS.md) (where we are).

## How every milestone runs

1. **Plan first.** Each PR in a milestone has a plan in `plans/<feature>.md` (goal, approach, files, risks, tests, skills) before code, as `CLAUDE.md` says. Major architectural changes wait for the product owner's approval.
2. **Small PRs into `dev`**, from `feature/<name>` branches or G.O.A.T. issue branches. Each PR keeps the game playable and every existing test passing.
3. **Review:** the `pr-reviewer` agent (or the G.O.A.T. Review agent on G.O.A.T. issues) until it approves. A person merges.
4. **Record:** non-trivial decisions in `decisions/`, progress in `docs/PROGRESS.md`.

### Definition of done (every PR)
- [ ] `npm test`, `npm run build` and `npm run test:e2e` pass locally and in CI (from M0).
- [ ] New logic has unit tests, including the edge cases; new content passes its validators with zero problems.
- [ ] New or changed flows have browser tests: keyboard and touch, the four reference sizes (1366 x 768, 390 x 844, 844 x 390, 768 x 1024), every text size, reduced motion, low quality, storage blocked.
- [ ] No console errors; no network requests beyond the game's own files.
- [ ] The architecture import test passes (from M2).
- [ ] A real play-through in Chrome, noted in the PR.
- [ ] `docs/PROGRESS.md` updated; new assets in `CREDITS.md` with their licence.

### Testing requirements by kind of change

| Change | Also required |
| --- | --- |
| Game rules (flight, courses, conditions, progression, save) | Property tests with seeded randomness; the "play everything once" fixture still totals the expected XP |
| Save format | v1 and older-version fixtures, a merge property test, the two-window browser test |
| Content | Facts checked against NASA pages and dated; a person reads new quiz questions against their sources |
| Rendering or effects | Pixel-sampling browser test for the effect; textures freed on leave; frame rate measured on the reference Chromebook at the end of the milestone |
| UI screens | Overlap and target-size checks at every size and text size; contrast test for any new token pair; screenshots at the four sizes in `docs/visual-baseline/` |
| Sound | Works muted and with audio blocked; nothing plays before the first tap |

## Milestones at a glance

```
M0 Safety net ──▶ M1 Foundations ──┬──▶ M2 Core systems ──┬──▶ M4 The loop on every world ──┬──▶ M6 Customization and collection ──┐
                                   │                      │                                 │                                    │
                                   └──▶ M3 Tokens and ────┘──▶ M5 Flight and first action ──┤                                    ├──▶ M9 MVP release
                                        components                                         └──▶ M7 Sound ──────────────────────┤
                                                                          M8 Presentation pass (after M3, M5; alongside M6-M7) ─┘
After the MVP: P2-A Astronaut · P2-B Learning mini-games · P2-C More action · P2-D Moon, gear and collections · then Phase 3
```

| Milestone | Goal | Issues | Depends on |
| --- | --- | --- | --- |
| **M0** Safety net | Nothing untested reaches `dev`; real Chromebook numbers | #26, #27, #28 | — |
| **M1** Foundations | Safe saves, quick fixes, Chromebook readiness, screens | #29, #30, #31, #32 | M0 |
| **M2** Core systems | Content, events, conditions, progression, assets, audio and input services | #18 + new issues | M1 |
| **M3** Tokens and components | The visual system's parts, under today's look | #21 (part 1) | M1 (#31) |
| **M4** The loop on every world | Star Map, fly-by worlds, question pools, XP and ranks, rewards, Grand Tour, welcome | #19, #20 (parts) | M2, M3 |
| **M5** Flight and first action | Capsules, the honest cockpit HUD, the Asteroid Belt Run | #19 (parts) | M2, M3 |
| **M6** Customization and collection | Hangar (rocket), Journal, patches | #20 (parts) | M4 |
| **M7** Sound | Effects and Listen everywhere | #34 | M2 |
| **M8** Presentation pass | Cinematic 3D, restyle of the older screens, pointer and floating-stick controls | #21 (part 2), #22, #24 (part) | M3, M5 |
| **M9** MVP release | Accessibility and performance pass; end-to-end QA; release candidate on `dev` | #24, #25 | M4-M8 |

**One change from the earlier order (approved 2026-11-11):** design tokens and components (M3) move ahead of the new screens instead of after them. Otherwise the Star Map, reward screen, Mission Control and Hangar would be built in the old style and restyled later. Only the parts are built early; the full restyle of the older screens stays late (M8), as approved.

---

## M0: Safety net

**Goal:** nothing reaches `dev` untested again, the quiz bugs are fixed, and every later choice can use real Chromebook numbers.

| Issue | Deliverable |
| --- | --- |
| #26 | The two quiz bugs from the PR #14 review, fixed with tests |
| #27 | CI: `npm ci`, tests, build and browser tests on every PR into `dev`; bundle size reported |
| #28 | Frame rate, landing freeze, memory and voice measured on a real Chromebook, in `PROGRESS.md` |

**Acceptance criteria**
- [ ] Shift+Tab never leaves the quiz card; a stale "Yes! That is right!" can never appear on a new question.
- [ ] Every PR into `dev` shows a passing CI check; a failing test fails it. A person turns on "require the check" for `dev`.
- [ ] Chromebook numbers recorded: device, Chrome version, fps idle, boosting and on autopilot, the landing freeze for both photo sizes, tab and GPU memory, read-aloud.

**Testing:** each bug fix has a test that fails without the fix; CI shown failing once on a throwaway branch.

## M1: Foundations

**Goal:** the code can grow safely: saves that keep new data, the renderer and screens split out of `Game`, and the game ready for a Chromebook.

| Issue | Deliverable |
| --- | --- |
| #29 | Save v2: `SaveData`, `SAVE_SCHEMA`, `migrate`, `merge`, `SaveStore` (TECHNICAL_ARCHITECTURE.md 4.5, 5.13) |
| #30 | The honest speed lesson, "flying past" wording, the landing-card focus trap, `?debug=1` only, per-entry quiz fail-soft |
| #31 | `RendererHost` with quality and context loss; no antialiasing on low; pixel ratio cap; off-thread photo decode; 2048 Earth photo; `data-quality` on `<html>` |
| #32 | Screen manager: `Screen`, `ScreenContext`; `SpaceScreen` and `ArrivalScreen` take today's code out of `Game` (approval of the plan first) |

**Acceptance criteria**
- [ ] A v1 save loads with every star; unknown fields survive load and save; another window's progress appears without reload.
- [ ] `Game` is a shell under 150 lines; space and arrival are screens; behaviour is unchanged.
- [ ] Losing the WebGL context recovers (or explains itself) instead of going black.
- [ ] On the reference Chromebook, the landing freeze is below 250 ms and flying holds 30 fps on the level it picks (or the gap is recorded with a plan).
- [ ] The HUD never says a rocket outruns light without saying it is pretend.

**Testing:** save fixtures and a merge property test; all 136 existing browser tests unchanged and passing after the screen split; a forced context-loss browser test; Chromebook re-measured.

## M2: Core systems

**Goal:** the shared middle of the architecture, with today's features re-expressed on it and no visible change.

| Deliverable | Architecture section |
| --- | --- |
| Shared ids and content types; `loadContent()` with cross-reference checks and per-entry fail-soft | 4.1, 4.2, 5.8 |
| `EventBus` and the progression recorder | 4.4, 5.2 |
| `Condition`, `isMet`, `progressOf` | 4.3 |
| `deriveProgression`, `diffProgression`, `progression.json` | 4.6, 5.4, 5.5 |
| Today's "find 3" missions and stars re-expressed as conditions and derived | 5.3 |
| `AssetManager` and the manifest; the ship and photos load through it | 4.15, 5.11 |
| `AudioManager` skeleton (no sounds yet) and `SettingsStore` with the new fields | 4.15, 5.12 |
| `InputManager` with today's keyboard and touch sources (no new controls yet) | 4.15, 5.14 |
| `tests/architecture.test.ts` (import rules) | 3 |

**Issues:** #18 (experience contract) is closed by the approved design docs plus this milestone's types. Split the rest into one issue per row before starting.

**Acceptance criteria**
- [ ] The game plays exactly as before; every existing test passes.
- [ ] The real data files load with zero `problems`.
- [ ] Stars and missions on Earth and Mars come from `deriveProgression`, and match today's for every v1 fixture.
- [ ] The architecture test passes, and fails on a deliberate bad import.

**Testing:** unit tests for every condition kind, the recorder for every event, the progression fixture totals; fake storage, fake Howler and fake input for the services.

## M3: Tokens and components

**Goal:** the visual system's building blocks (VISUAL_DESIGN.md sections 4-6), ready for the new screens, with today's screens moved onto tokens without a visible change.

**Deliverables:** `src/ui/styles/tokens.css` and `src/ui/tokens.ts`; Fredoka and Lexend self-hosted with their licences; the components (glass panel, buttons, segmented control, tile, chip, instrument, progress bar, star row, rank badge, patch, Orbit dock, hotspot, dialog, toast, focus ring); quality and reduced-motion modes in CSS; the settings panel height bug fixed.

**Acceptance criteria**
- [ ] Every component works at every text size and breakpoint, keyboard and touch, high and low quality, reduced motion.
- [ ] Every text and background token pair passes 4.5:1 in the worst case (a unit test computes it).
- [ ] Today's screens look the same, apart from the new fonts and the settings fix.
- [ ] Fonts are under 100 KB in total and load from the game's own files.

**Testing:** a component test page used by the browser tests; the contrast test; screenshots at the four sizes.

## M4: The loop on every world

**Goal:** the GAME_DESIGN.md core loop works on all 10 worlds: pick, fly, arrive, explore, mission, question, reward, next. (The asteroid belt, the 11th place, arrives in M5.)

| Deliverable | GAME_DESIGN.md |
| --- | --- |
| Star Map overlay (HTML orrery, real-distance toggle, stars, Grand Tour glow) | 2 |
| Mission Control shell with the Missions and Settings tabs; one menu button | 2, 9 |
| Fly-by arrivals for the Sun, Mercury, Venus, the Moon, Jupiter, Saturn, Uranus and Neptune: NASA photos with licences, 3 dots, "find 3", a postcard pool | 6.1, 8 |
| Question pools for Earth and Mars (6-9 each), levels, the seeded draw, shuffled answers | 8, 13 |
| XP, ranks and stars shown; the reward screen and toasts | 3, 10 |
| Grand Tour chapters 1-4 and Orbit's suggestions | 9 |
| Welcome screen, call signs from a list, First flight | 1, 2, 5 |

**Acceptance criteria**
- [ ] Every world on the Star Map can be reached and has something to find; no "coming soon" remains.
- [ ] A new player can go from the welcome screen through First flight to their first star without help (checked in a play-through).
- [ ] Replaying a quiz gives a different set or order; the bonus star needs a first-try run.
- [ ] Doing everything once totals about 1,150 XP (rank 7), matching the design.
- [ ] Every new fact has a NASA source and date; every photo has its credit and licence.

**Testing:** the loop end to end in the browser for a full-landing world and a fly-by world; the Star Map by keyboard and touch; quiz draw property tests; content validators; a person reads every new question against its sources.

## M5: Flight and first action

**Goal:** flights have something to do, and the first action challenge is fun and never punishing.

| Deliverable | Architecture / design |
| --- | --- |
| `stepFlightWithEvents`, contacts, checkpoints, bounce, `ObstacleIndex` | Arch 4.13 |
| Capsules on routes (`capsules.json`), capsule facts | GDD 6.3 |
| Cockpit HUD with instruments, edge arrow and capsule counter | VD 7.3 |
| The asteroid belt as a place; `buildCourse`; `FlightCourseScreen`; Cadet, Pilot and Ace courses; stopwatch and personal best; three stars | GDD 7, Arch 4.12 |
| Flight assist setting (Full, Some, Little) for challenges | GDD 13 |

**Acceptance criteria**
- [ ] Every existing flight-model test passes unchanged; docking on normal trips still cannot fail.
- [ ] A bump bounces the rocket and adds 2 s; there is no failure state, no countdown and no red; Leave keeps what was collected.
- [ ] The same course seed always builds the same course.
- [ ] 200 rocks stay within the frame budget on the reference Chromebook at low quality.
- [ ] Autopilot passes capsules by; nothing is lost by not steering.

**Testing:** property tests for contacts and bounce, the course builder and the stopwatch; browser tests for a Cadet run by keyboard and touch, and for Leave; Chromebook frame rate in the belt.

## M6: Customization and collection

**Goal:** progress becomes visible and personal.

| Deliverable | Design |
| --- | --- |
| Hangar screen with the `HangarScene` turntable; paint, decals and exhaust (`items.json`); tap to equip; locked items show how to earn them | GDD 4, VD 7.7 |
| The equipped look in flight and in challenges | Arch 5.6 |
| Journal (fact pages, capsule facts, found dots remembered, "Take me there") | GDD 11, VD 7.9 |
| Patch board and 12 MVP patches (`patches.json`) | GDD 12, VD 7.10 |

**Acceptance criteria**
- [ ] Unlocks follow their conditions exactly; a locked item can never be equipped; equipping survives reload and a second window.
- [ ] Every Journal page opens its fact card with Listen; empty pages say where to look.
- [ ] All 12 patches can be earned, and each shows its condition before it is earned.

**Testing:** unlock and equip unit tests; a browser test that earns, equips and reloads; Journal and patch board by keyboard and touch; the turntable frees its scene on leave.

## M7: Sound

**Goal:** gentle effects and read-aloud everywhere (#34).

**Acceptance criteria**
- [ ] The effects in #34 play on their events; volumes and mute work and are remembered.
- [ ] Listen works on Orbit's words, mission lines, reward screens, Journal pages and patch conditions.
- [ ] Nothing plays before the first tap; the game works muted and with audio blocked.
- [ ] All sounds together are under about 500 KB, loaded after the first frame, with licences recorded.

**Testing:** the cue table unit test; fake-Howler tests; browser tests muted and with audio blocked.

## M8: Presentation pass

**Goal:** the cinematic look and the full visual system on every screen, within the Chromebook budget.

**Deliverables:**
- **3D (#22):**
  - tone mapping, an environment map and lighting
  - atmosphere shells, the banded ring and real planet textures (KTX2, or 1024 px for far worlds)
  - the nebula, plus bloom on high only if the numbers allow
- **Older screens restyled (#21, part 2):** the landing and fly-by views, the fact card, the quiz and settings, and the holographic details.
- **Controls (#24, part):** pointer-drag steering, the floating touch stick, and hold or toggle Boost.

**Acceptance criteria**
- [ ] Every screen matches VISUAL_DESIGN.md at the four sizes.
- [ ] 30+ fps on the reference Chromebook at the level it picks; low quality has no blur and no bloom.
- [ ] A Chromebook touchpad can steer without the keyboard.
- [ ] First play is still under 15 MB.

**Testing:** pixel-sampling tests for the new effects; before and after screenshots; Chromebook frame rate and memory; the controls by touchpad and touch.

## M9: MVP release

**Goal:** a reviewed release candidate on `dev` (#24, #25). A person decides when `dev` goes to `main`.

**Acceptance criteria**
- [ ] The full loop works from a clean save and from a v1 save.
- [ ] Keyboard-only and touch-only passes of every flow; text sizes, reduced motion, low quality and read-aloud all work.
- [ ] Performance targets met on the reference Chromebook, with the numbers in `PROGRESS.md`.
- [ ] Every fact sourced and dated; every asset credited; the product rules checked one by one.
- [ ] README, `ASSETS.md`, `CREDITS.md` and these docs match what the game does.

**Testing:** a manual QA matrix (devices, sizes, settings) recorded in the PR; all automated suites; repeat runs of the browser tests to catch flaky ones.

---

## After the MVP

| Milestone | What (GAME_DESIGN.md section 16) | Depends on |
| --- | --- | --- |
| **P2-A** Astronaut | Astronaut model in Blender (#23); suit, visor, backpack, helmet light; earned patches on the suit; call sign card | M6 |
| **P2-B** Learning mini-games | Photo Detective, Planet Lineup, Weigh-in, Light-Speed Messenger (as activities) | M2, M4 |
| **P2-C** More action | Ring Gate Runs (one route per chapter), rescue missions with towing, Orbit's requests | M5 |
| **P2-D** Moon, gear and collections | Moon landing in an Apollo panorama; Telescope and Radio dish gear; spacecraft cards; postcards; 12 more patches; music; gamepad | M6, M7 |
| **Phase 3** | Two advanced challenges chosen after playtests; rocket parts and patterns; Spectrometer and Magnetometer; Orbit in 3D; up to three pilots on one computer and "start over" (a data-deletion decision for the product owner) | Phase 2 |

Each gets the same acceptance and testing rules as the MVP milestones before it starts.

## From the approved step list to milestones

| Approved step (PROJECT_AUDIT.md) | Milestone |
| --- | --- |
| 1-3: PR #14 fixes, CI, Chromebook measurement | M0 |
| 4-7: save v2, quick fixes, Chromebook readiness, screen manager | M1 |
| Experience contract (#18) | M2 (with the approved design docs) |
| 8, 9, 10: every world has something, visible progress, question pools | M4 |
| 11, 12, 13: flight events, capsules, asteroid course | M5 |
| 14, 19: Hangar, Journal and patches | M6 |
| 15: sound effects | M7 |
| 16, 17, 18: cinematic pass, glass UI, controls | M8 (tokens and components moved earlier into M3) |
| Accessibility, performance, QA (#24, #25) | M9 |
| 20, 21, 22: rescues and timed runs, more landings, Orbit in 3D and the astronaut | P2-A, P2-C, P2-D, Phase 3 |

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
