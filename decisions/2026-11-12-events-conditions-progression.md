# Events, conditions and derived progression

Date: 2026-11-12. Decided by the Plan agent for issue #39 and approved at plan review (autopilot); built by the Implement agent as a stack of 4 PRs.

## What was decided

1. **D1. Type homes.** `src/data/` (Content) may import only Content (`tests/architecture.test.ts`). `MissionDef.goal` needs `Condition`, and `Content.progression` needs `ProgressionRules`. So the types `Condition`, `ProgressionRules` and `XpSource`, and their validators, live in `src/data/conditions.ts` and `src/data/progression.ts`. `src/core/conditions.ts` and `src/core/progression/index.ts` re-export them with `export type { … }`, so code still imports them from the paths in `docs/TECHNICAL_ARCHITECTURE.md` 4.3 and 4.6. No type shape changes.
2. **D2. v1 missions stay done.** A `find` mission is done when `isMet(goal)` is true **or** `save.worlds[place].missionDone` is set. Stars on a place are a mission star (`worlds[p].missionDone`, or any `find` mission at `p` done), a quiz star (`quizzes[p].done || worlds[p].quizDone`) and a perfect star (`quizzes[p].perfect || worlds[p].perfectQuiz`). A mission done by the flag shows progress `{ done: of, of }`. This keeps a world with a v1 flag and no mission in content (Venus in the e2e old-save test) at its stars.
3. **D3. The recorder also writes the v1 flags.** A dot that finishes a `find` mission sets `worlds[p].missionDone`. `quizFinished` sets `worlds[p].quizDone` and ORs `perfectQuiz`, as well as `quizzes[p]`. A tab still running v1 code, or a rollback, still shows every star.
4. **D4. Repeats.** Keys are `<XpSource>:<id>`: `dot:<DotId>` when an already-found dot is found again, and `quiz:<PlaceId>` when a finished quiz is finished again. The stored count is capped at `rules.repeatCap`. Repeat XP is `min(n, repeatCap) × xp[source].again` for `dot` and `quiz` keys whose id exists in content. Mission repeats give nothing yet: once dots are remembered, no event can finish a `find` mission twice.
5. **D5. Dots found ever.** `dotsFound` counts dots found on any visit (4.3 as written). A kid who finds 2 dots, leaves and comes back finishes "find 3" with the next new dot. In one fresh visit the mission still finishes on the third dot. This is the one behaviour change, and it matches `GAME_DESIGN.md` 6.2 ("found dots are now remembered").
6. **D6. Unsupported kinds.** `rank`, `chapterDone` and `patch` give `isMet` false and `progressOf` `{ done: 0, of: 1 }` until #46, #47 and #54. `validateCondition` rejects them, and also `courseDone` and `activityDone` (no content to check their ids against yet), with `"<kind>" is not supported yet`, so data cannot rely on a silent false. `isMet` still implements `courseDone`, `activityDone` and `capsules` from the save.
7. **D7. Interim `MissionDef`.** As in 4.7, but the validator accepts only `kind: 'find'`. A `find` mission needs `place`, a goal `dotsFound` at that same place, and a `teaser`. There is at most one `find` mission per place. `chapter?` and `available?` stay in the type; `rescue` and `ChapterDef` come with their issues (the "arrives with its first user" rule of `2026-11-11-content-loader-interim-types.md`).
8. **D8. View field meanings.** `rank.xpForNext` is the XP still needed for the next rank (`next.xp − xp`), `null` at the last rank. `RewardDiff.newStars[].count` is the new total on that place. `stars.byPlace` has an entry for every place in `content.places` (0 included). `stars.byCourse`, `chapters`, `patches` and `unlocked` stay empty until their content exists. `journal` has an entry for each place with a landing picture: found dots in hotspot order, and `total` = number of dots.
9. **D9. Event bus.** `createEventBus()` calls handlers at once, in subscription order, over a copy of the handler list. A handler that throws is logged with `console.error` and the rest still run. The app shell subscribes the recorder first, so when `emit` returns the save is already updated and the screen can read `ctx.progression()` straight away.
10. **D10. Fallback rules.** A missing or broken `progression.json` gives `FALLBACK_RULES` (every XP value 0, `repeatCap` 0, one rank `{ 1, 'Cadet', 0 }`) and a line in `content.problems`. Stars and missions still work, because they do not use the rules.
11. **XP values for ranges.** The design gives side missions 15-25 XP and mini-games 10-15. `progression.json` uses one value each (20 and 10) until their own issues tune them.

## Small choices made while building
- **A quiz replay counts from either record.** `quizFinished` counts a replay (`quiz:<place>`) when the quiz is already done in `quizzes[place]` **or** in the v1 flag `worlds[place].quizDone`, so a kid upgraded from v1 gets replay XP the first time too.
- **Within one visit, a dot's card opened again is not a new event.** The HUD calls `onDotFound` only for the first open of each dot on a visit, so `dot:<id>` replays count once per visit, not per tap.
- **The save format and store tests keep their v1 helpers.** `tests/saveSchema.test.ts` and `tests/saveStore.test.ts` wrote saves with `recordMission`, `recordQuiz` and `starsFor` from `src/core/progress.ts`. Those now come from a small test fixture (`tests/fixtures/worldFlags.ts`) that sets and reads the v1 flags directly, so those tests still check the store and the merge, not progression. The old progress tests moved into `tests/recorder.test.ts` and `tests/progression.test.ts`.

## Why
- One recorder that alone writes the save, and one derivation that alone works out stars, missions, XP and ranks, means there is nothing to get out of step and nothing to merge (architecture 4.5).
- Honouring the v1 flags (D2, D3) keeps every old save's stars without inventing facts.
- Rejecting unsupported condition kinds in the validator stops data from silently never finishing.

## Alternatives
- **An `ALLOWED_BREAKS` entry so `src/data/` can import `src/core/`.** The test forbids that for new code.
- **Duplicate the types in data and core.** They would drift apart.
- **A `legacy` condition kind for v1 saves.** Changes a shared type for a migration detail.
- **Migrate the v1 flag into made-up dots.** Invents facts and Journal pages the kid never saw.
- **Count dots per visit, as before.** Contradicts 4.3 and the design's "found dots are remembered".
