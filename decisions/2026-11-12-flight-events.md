# Flight events: contacts, checkpoints, bounce and the obstacle grid

Date: 2026-11-12. Decided by the Plan agent for issue #49 and built by the Implement agent, with one change made during the build (item 5). A person can overrule any line at PR review. The code is `src/flight/flightModel.ts` and `src/flight/obstacleIndex.ts`; the types are in `docs/TECHNICAL_ARCHITECTURE.md` section 4.13.

## What was decided
1. **`stepFlight` is a thin wrapper:** `stepFlightWithEvents(...).state`. With a plain obstacle list and no `bounce`, the movement code does exactly the same arithmetic as before (sub-steps sized from the smallest obstacle, `delta / steps` per sub-step, radial push-out). `tests/flightEvents.test.ts` compares it step by step with a frozen copy of the old code (`tests/fixtures/legacyFlight.ts`).
2. **Bounce on a ship that only has a speed.** `ShipState` has no velocity vector, so a bounce works on `forward * speed`: if it points into the rock, mirror it about the contact normal with restitution `e` (clamped to 0..1), `v' = v - (1 + e)(v·n)n`. The nose then points along `v'` (pitch clamped; if `v'` is almost zero, along the normal), speed becomes `min(speed, max(0, speedAfter))`, and both turn rates go to 0, so the ship does not swing straight back into the rock. The rest of the step continues on the new heading.
3. **Checkpoints are reported on entry.** A checkpoint is in `passed` on the step where the path (every sub-step segment) comes within its radius, if the ship started that step outside it. The step stays pure and stateless, works at any frame rate (it is a swept test), and reports a fly-through once. Remembering what was already collected is the caller's job (#51 marks crystals `taken`).
4. **`ObstacleIndex` gained `readonly bodies`.** This changes a shared type. The step needs each body's centre and radius, and the 4.13 interface only had `near`. Contact indexes refer to `index.bodies`. `createObstacleIndex` copies and freezes the list, so the caller cannot desync the grid. The largest radius is cached per index in a `WeakMap`, so any `ObstacleIndex` implementation works without another field.
5. **A bounce finds the exact point where the ship meets the shell (changed during the build).** The plan said to push the ship out radially "as today" and then bounce. A radial push puts the contact point and normal wherever the sub-step happened to end up inside the shell, up to about half a radius off at 10 fps. Then the bump point and the bounce direction change with the frame rate, and a grazing hit can be caught at one frame rate and missed at another. So with `bounce` set, each sub-step does a ray-against-sphere test for every nearby shell, puts the ship on the shell where it first meets it, bounces off that normal, and spends the rest of the sub-step on the new heading. The radial push still runs afterwards as a safety net. Sliding (no `bounce`) is unchanged.
6. **Index query radius:** `near(from, 2 * travel + max(0, obstacleFactor - 1) * largestRadius)`, where `travel = speed * dt` after easing (a bounce only lowers it). A push-out can carry the ship a little past the straight travel distance, hence twice the travel. No nearby body means one sub-step and no collision checks.
7. **The grid:** default cell size is twice the largest radius. Each body is stored in every cell its bounding box touches. `near` walks the cells under the query's bounding box, filters exactly by distance, and returns the indexes ascending. A query that would walk more cells than there are bodies (a huge radius, or a broken number) checks every body instead.

## Why
- Normal trips must not change at all, and action challenges (#51) need bumps they can count, crystals they can collect, and 200-rock courses that stay cheap. Measured: about 5 µs per step at 60 fps and about 26 µs at 10 fps with 200 rocks, bounce and boost, against a 1 ms limit (`tests/flightBench.test.ts`).
- Acceptance asks for the same results at any frame rate. Item 5 is what makes bumps meet that bar.

## Things #51 needs to know
- **Contacts are raw, per step.** A glancing bounce plus the pull toward a target can touch the same rock again on the next step. #51 decides what counts as one "bump" (for example, a rock not touched in the previous step).
- **Overlapping obstacles are not handled.** Pushing out of one shell can push into another, as before. The tests use fields with wide gaps, and `buildCourse` guarantees `gapMin`.
- **`passed` repeats if the ship leaves a checkpoint and comes back in.** Keep the collected set.

## Alternatives
- **Track collected checkpoints in `ShipState`:** changes a shared type that every caller and save path sees, for something only courses need.
- **Add a velocity vector to `ShipState` for bounce:** a big shared-type change, and it would alter normal flight.
- **Use the index's nearby-only sub-steps for plain lists too:** would change `stepFlight`'s numbers.
- **Radial push-out then bounce (the original plan):** simpler, but the bump point and direction depend on the frame rate (item 5).
- **Use the exact meeting point for sliding too:** would change `stepFlight`'s numbers.
- **`near` returning whole cells (a loose superset):** harder to test and to reason about. Exact filtering costs little at 200 bodies.
- **A new dependency (fast-check, a spatial library):** the repo already writes seeded property tests by hand, and the grid is about 60 lines.
