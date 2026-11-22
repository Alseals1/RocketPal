# Fly-by arrivals, `ArrivalDef`, and remembered dots

Date: 2026-11-21 (planned), built 2026-11-22. Decided by the Plan agent for issue #43 and approved at plan review; built by the Implement agent.

## What was decided
1. **`ArrivalDef` is adopted as written in `docs/TECHNICAL_ARCHITECTURE.md` 4.9**, with `worldId` renamed to `place` in the type, in `public/data/surfaces.json` and in every reader. `Content.arrivals` is `Map<PlaceId, ArrivalDef>`. This closes the `arrivals` row of `2026-11-11-content-loader-interim-types.md`. `'course'` is in the type only: the validator refuses it until the belt is built.
2. **The validator holds the frame and the words to the kind.** A `flyby` needs `frame: "cockpit"`, a `window` needs `frame: "station"`, a `panorama` has no frame. `wording` is required, and the Sun and the giant planets must say `flyingPast`. A fly-by gets the same photo checks as a window (a field of view, and every dot inside the photo).
3. **The words come from the data.** The space screen's plain card and its "Great flying!/Great landing!" line read the arrival's `wording`. `arrivalWording(place)` stays only as the fallback for a place with no arrival picture.
4. **The Moon says "flying past".** GAME_DESIGN names only the Sun and the giant planets, but the Moon's view is a photo taken from a spacecraft passing by, so "landed" would be untrue. Phase 2's Apollo landing can say "landed" again.
5. **A fly-by photo's `photo.horizontalFov` is a chosen display angle, not a lens angle** (a planet portrait has no useful lens data). It is picked so the world fills about two thirds of the window at 1366x768; `verticalFov` follows from the photo's aspect.
6. **The new VISUAL_DESIGN 7.5 look is for fly-by only.** Earth and Mars keep today's look until #55. Behaviour (remembered dots, data-driven wording) applies to every arrival.
7. **Remembered dots are a display fix.** `dots` is already in save v2 and the recorder already saves each find, so the HUD is seeded from the save. The first open of a dot on each visit still sends `dotFound`, so a repeat still earns the recorder's repeat XP, exactly as before.
8. **Fly-by photos are 2048 px (high) and 1024 px (low).** A window view never needs a 4096 file; the low file serves low quality.
9. **The photos (approved by the product owner on 2026-11-21, "Go with what's recommended"):** the Moon is Artemis II `art002e009057` (credit "NASA"), Jupiter is Cassini `PIA04866` (credit "NASA/JPL/Space Science Institute"). GAME_DESIGN 6.1 now says Cassini, not Juno, for Jupiter: no Juno full-disk photo credited to NASA alone was found.
10. **The Moon photo is cropped to a square round the Moon** (a 5040 x 5040 box of the 8256 x 5504 original, the Moon about 44% of its width, display angle 50 by 50 degrees). Uncropped, the Moon is only about a quarter of the photo's width. A first, wider 3:2 crop filled two thirds of a computer screen, but on a phone held upright the window view zoomed in so far that no edge of the Moon showed and it read as grey rock; the square crop shows the whole Moon on every screen shape, at about half the width of a computer screen. Jupiter's photo is only resized, to 1638 x 2048 so no side is over 2048. Recorded in `CREDITS.md`.
11. **A "flyingPast" title starts with "Flying past "**, checked by the validator, so the loading line ("Flying to the Moon...") can be made from it without a second name field.
12. **The plain fallback card knows about solid ground.** If a fly-by photo cannot load, the card says "You are flying past The Moon!" and "We are zooming past for a look." for the Moon, and keeps "There is no solid ground to land on here." for the Sun and the giant planets only.
13. **A postcard's perfect result says "Right on the first try!"**, not "All three right", since it has one question.

## Why
- 5.10 says a fly-by is the window view with a cockpit frame, so the view, its geometry and its look limits are reused as they are (`isWindowLike`).
- Keeping the type true to 4.9 now means #44 only adds data and photos.
- Seeding the HUD from the save keeps every reward rule unchanged.

## Alternatives
- **A separate `FlybyScreen` and HUD.** Duplicates the window view the docs say to reuse.
- **Seeding found dots by skipping `dotFound` for saved dots.** Would stop the repeat XP for re-reading a dot on a later visit: a silent reward change.
- **Restyling Earth and Mars here too.** Doubles the change and is #55's job.
- **Keeping `worldId` with an `ArrivalDef` alias.** Leaves the 4.9 type untrue and the rename for #44.
