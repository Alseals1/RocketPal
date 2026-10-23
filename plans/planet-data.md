# Feature: planet-data

Branch: `feature/planet-data` (cut from `dev`).

## Goal
The editable science content for all ten worlds, plus the pure functions that turn real numbers into kid-friendly readouts. Done = `public/data/planets.json` validates, the readout functions are tested, nothing renders yet.

## Approach
* `public/data/planets.json`: Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune. Per world: `id`, `name`, `kind` (star/planet/moon), `parent` (Moon only), `diameterKm`, `distanceFromSunKm`, `distanceFromParentKm` (Moon only), `orbitDays`, `moons {count, verify}`, `hook`, `color`. File-level `lastChecked` and `source`.
* Numbers come from the NASA Planetary Fact Sheet (metric, page updated 18 Mar 2025, read 2026-10-23). Sun diameter is 2 x NASA's volumetric mean radius (695,700 km). Moon counts change, so every planet with moons that can still change is `verify: true`.
* `src/data/planets.ts`: types, `validatePlanets(raw)` returning a list of human-readable problems (empty = valid), and `loadPlanets()` (fetch + validate).
* `src/scale/readout.ts`: `formatDistanceKm`, `lightTravelSeconds`, `formatDuration`, `distanceBetweenKm`, `realDistanceRemainingKm`, `realSpeedKmPerSec`. Used by the HUD in `feature/fly-scene` so the compressed scene still shows real numbers.
* Housekeeping from the PR #1 review: fix the "Files touched" list in `plans/project-setup.md` and trim session-specific notes from the Blender section of `README.md`.

## Skills / tools
`tdd` (red then green, one slice at a time, only at the agreed seams: readout/scale and planets.json validation). NASA fact sheet via web fetch.

## Risks
* Moon counts and some figures change; mitigated by `lastChecked` and `verify` flags, called out in the PR.
* `distanceBetweenKm` assumes worlds line up on one side of the Sun (a "closest approach" distance). Documented in the function; good enough for a teaching readout.

## Testing
* Vitest: validator accepts the real `planets.json` and rejects bad data (missing world, duplicate id, missing/invalid `lastChecked`, non-positive diameter, unknown parent). Readout tests use hand-worked literals (e.g. Earth to Sun = about 8 minutes of light time).
* Build must still pass; no browser change, so the existing Playwright smoke test is re-run.
