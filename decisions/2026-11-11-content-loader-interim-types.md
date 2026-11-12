# One content loader, with today's entry types for now

Date: 2026-11-11. Decided by the Plan agent for issue #38 and approved at plan review; built by the Implement agent.

## What was decided
1. **One loader.** `loadContent()` in `src/data/content.ts` replaces `loadPlanets`, `loadSurfaces`, `loadMissions` and `loadQuizzes` (and `keepValidQuizzes`). It fetches the four files at the same time and hands them to the pure `buildContent()`, which checks them entry by entry and builds the `Content` maps. `Game` takes `Content` directly.
2. **Only the `Content` fields today's data fills.** `places`, `worlds`, `arrivals`, `quizzes`, `missions` and `problems`. The other fields in `docs/TECHNICAL_ARCHITECTURE.md` 4.2 (capsules, chapters, courses, activities, items, patches, progression, sounds) arrive with the issues that add their files.
3. **The map keys follow 4.2; the entry types stay as today until their own issues change them.** The 4.2 shapes need fields and data that do not exist yet.

   | Field | Today | Becomes | With |
   | --- | --- | --- | --- |
   | `arrivals` | `Map<PlaceId, Surface>` | `Map<PlaceId, ArrivalDef>` (with fly-by worlds and `wording` in the data) | #43 / #44 |
   | `quizzes` | `Map<PlaceId, Quiz>` (one quiz of 3 questions per world) | `Map<PlaceId, QuestionPool>` | #45 |
   | `missions` | `Map<PlaceId, Mission>` (one per world, keyed by world) | `Map<MissionId, MissionDef>` (with conditions) | #39 |
   | `places` | the 10 worlds | the 10 worlds and the belt (`kind: 'region'`) | #51 |
   | `worlds` | `Map<WorldId, World>`, with `World.id` still a `string` | unchanged for now | — |

4. **What is dropped is one top-level entry:** one world, one landing picture, one quiz or one mission. One bad dot drops its whole picture, and one bad question its whole quiz. Dropping single questions and dots comes with question pools (#45).
5. **A dropped entry takes what points at it.** A world takes its moon, landing picture, quiz and mission (and any mission whose teaser points at it). A landing picture takes its quiz and mission. The game still starts without them. Only a `planets.json` that is unusable as a whole (cannot be loaded, not an object, bad `lastChecked`, no `source`, `worlds` not a list) or keeps no world at all stops the game, as before.
6. **The first copy of anything listed twice is kept**, as `keepValidQuizzes` did. The later copy is reported with `(kept the first)`.
7. **A new check: a world id must be one of the ten** (`<id>: not one of the ten worlds`). `WORLD_IDS` and `isWorldId` live in `src/data/ids.ts` with the 4.1 id types.
8. **Console wording is unchanged**, so the browser tests' allowlists still match: one `Some worlds|landing pictures|missions|quizzes were left out:` per file that lost entries, `Bad planets|surface|mission|quiz data:` for a file unusable as a whole, and `Could not load <url> (<reason>)` for a file that could not be fetched. Every problem also goes into `content.problems` as `<file>.json: <message>`; a file that could not be fetched adds `<file>.json: could not be loaded` (the console line has the reason).

## Why
- One bad entry used to take its whole file with it (planets, surfaces and missions were all-or-nothing), and every loader repeated the same fetch and fallback code.
- Keeping today's entry types means `Game` reads the same objects as before, so the game plays exactly the same. The issues that bring the new data change one field each, with no second loader.
- A test loads the real files and requires `problems` to be empty, so a cascade can never ship unnoticed.

## Alternatives
- **Reuse the file validators on one-entry files, as `keepValidQuizzes` did.** For planets this reports "world is missing" for the other nine worlds and false parent errors, so the output would need fragile filtering. Each validator was split into a file check and an entry check instead, and the old `validate<File>` functions are now built from those parts with the same messages.
- **An adapter in `main.ts` that rebuilds the old `PlanetData` / `SurfaceData` shapes for `Game`.** Keeps the old shapes alive and does the indexing twice.
- **Move to `ArrivalDef`, `QuestionPool` and `MissionDef` now.** Needs fields and data that do not exist yet, and the issue limits the scope to what today's content uses.
- **Treat a dropped world as fatal.** Contradicts "per entry, not per file". With cascading cross-references the rest of the game runs.
