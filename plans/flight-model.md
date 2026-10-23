# Feature: flight-model

Branch: `feature/flight-model` (cut from `dev`). First half of Phase 1 "Fly". The rendering, controls and HUD follow in `plans/fly-scene.md`.

## Goal
The rules of how the rocket moves, with no graphics, so they can be tested exactly: full 3D free flight (yaw, pitch, boost; no roll) with assists strong enough that a kid can never fail to land. Also the automatic low-quality chooser.

## Approach
* `src/flight/flightModel.ts`: pure `stepFlight(state, input, dt, context, config)` returning a new state. No Three.js, no DOM.
  * State: position, yaw, pitch, turn rates, speed, `docked`. No roll, so the ship is always level (auto-level by design).
  * Input: `turn` (-1 left .. +1 right), `pitch` (-1 down .. +1 up), `boost`. Out-of-range values are clamped.
  * Smooth turning and acceleration (eased), pitch limited just short of straight up/down.
  * **Destination assist:** with a target set, a gentle pull turns the nose toward it, weaker while the player steers that axis. Inside the capture range the pull takes over fully.
  * **Slow-down:** speed is capped by distance to the target, so the ship eases in and cannot overshoot.
  * **Docking cannot fail:** reaching the dock distance (a hover height above the surface) stops the ship and sets `docked`. The pull takes over completely inside the inner half of a capture range that scales with both the planet's size and the ship's speed (a fast ship has a wide turning circle and needs room), and the final creep speed scales with the planet's size, so tiny and huge bodies behave alike. (Added after review: the first version used a size-only range and could orbit a small planet forever at boost.)
  * **Obstacles:** other bodies push the ship back to just above their surface so it can never fly through a planet. Movement is sub-stepped so a fast ship cannot skip across a small body in one frame.
  * Big frame hiccups are capped (`dt` max 0.1 s) so the ship never teleports.
* `src/quality/quality.ts`: `initialQuality(hints)`, `chooseQuality(frameMs, current)` (median frame time; low stays low so quality never flaps), `qualitySettings(q)` (low = no glow, no shadows, fewer stars, pixel ratio 1).
* Review follow-ups from PR #2: Mars hook now says tallest volcano "in the whole solar system"; drop the brittle test that hard-coded which moon counts are flagged; fix `formatDistanceKm` rounding edges ("1000.0 million km").

## Files touched
`src/flight/flightModel.ts`, `src/quality/quality.ts`, `src/scale/readout.ts`, `public/data/planets.json`, `tests/flightModel.test.ts`, `tests/quality.test.ts`, `tests/readout.test.ts`, `tests/planets.test.ts`.

## Skills / tools
`tdd` at the agreed seams (flight model, quality chooser; readout fix is at the existing readout seam). Tests are written red first and use independent expectations (direction of travel, never entering a surface, always docking).

## Risks
* Full 3D flight is hard for ages 8-10 on touch: mitigated by no roll, auto-level, target pull and guaranteed docking. Real feel needs a play-through (done in `fly-scene`).
* Tuning numbers (rates, ranges) are guesses until flown; all live in one `DEFAULT_FLIGHT` config.
* The pull cannot save a player who holds the stick away forever outside the capture range; releasing it always lands. That is intended (free flight stays free).

## Testing
Vitest only (no UI in this PR). Docking is tested over planet radii 0.5 to 100, frame rates 60/30/15/10 fps, boost on and off, with 40 seeded random starts each (plus a one-off 13,500-start fuzz over radii 0.2 to 200 and fresh seeds while fixing review comments). The tests were mutation-checked: removing the slow-down, obstacle push-out, destination pull, speed-aware capture, full takeover, creep speed, or obstacle sub-stepping each makes a test fail.

Build and the existing Playwright smoke test must also pass. `npm run build` and the existing Playwright smoke test must still pass.
