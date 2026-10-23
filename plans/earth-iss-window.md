# Feature: earth-iss-window

Branch: `feature/earth-iss-window` (cut from `dev`). Landing at Earth: a real hover view from the International Space Station, built on the same look-around and fact-card system as Mars.

## Goal
When the rocket docks at Earth, the kid looks out of a space station window at a **real astronaut photograph of Earth** (a green aurora arcing over a cloudy ocean, the glowing edge of the air, stars, and the station's own solar array), taps glowing dots to read short NASA-checked facts (with Listen), and goes back to space. Done = it works by keyboard, touch, and tap/click only; credit is on screen and in `CREDITS.md`; nothing is faked without saying so.

## Decisions made with the user
* Earth uses a **real hover view from the International Space Station** (the user's choice).
* "Yes, use the NASA photos" (2026-10-23). This photo comes from the same kind of source, with its own written terms (below).

## The photo
* **iss073e0247726**, "The aurora australis arcs above a partly cloudy Indian Ocean". NASA's caption: taken June 12, 2025 from the International Space Station "as it orbited 269 miles above in between Australia and Antarctica". Nikon Z 9, 24 mm lens, original 8256 x 5504 px, 7,746,224 bytes, SHA-256 `06e009419a3d617990b54ad4a7d53bd80dad94557a4d24118046669b3b01594b`. Download: https://images-assets.nasa.gov/image/iss073e0247726/iss073e0247726~orig.jpg . No photographer is named in NASA's record, and no copyright notice is in the file (the only "Copyright" text is the camera software's standard colour-profile line).
* **Terms** (NASA JSC Gateway to Astronaut Photography of Earth, FAQ "Conditions of use of astronaut photographs"): "You are welcome to use our photos or videos, for which NASA does not maintain a copyright." Credit requested: "Image courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center". No implied NASA endorsement; NASA emblems and logos are protected; photos marked as copyrighted need the owner's permission (this one is not marked).
* **It is not a 360 degree picture.** NASA offers no 360 degree still from the station's Cupola (the 360 degree Cupola material is from Roscosmos and ESA, with different terms, so it is not used). So this is a single wide photo (24 mm lens on a full-frame sensor: 73.7 degrees wide, 53.1 degrees tall) shown as a **window view**: you can look a little around inside the window, and a **drawn window frame** surrounds it. The screen says the frame is drawn.
* Only resized (4096 and 2048 px wide, JPEG), no other editing.

## Approach
* `public/data/surfaces.json`: the Earth surface gets `kind: "window"` and a `photo` block (field of view). Mars becomes `kind: "panorama"`. The validator checks both.
* `src/surface/geometry.ts` (pure): `rectilinearPhotoToAzEl` (where a point in a normal wide photo is, as angles, so dots can be placed by pointing at the photo) and `windowLookLimits` (how far you may look round so the picture always covers the window). `stepLook`/`applyDrag` accept optional limits.
* `src/surface/panoramaScene.ts`: `loadWindow` puts the photo on a flat plane in front of the camera at exactly the camera angle the lens saw, so it looks like the photo, not a bent sphere. Camera field of view 50 degrees in window mode.
* `src/ui/surfaceHud.ts`: a drawn window frame overlay (SVG, no pointer events) for window surfaces.
* `Game`: picks the loader by `kind`, recomputes the look limits when the screen shape changes (a tall phone screen can look further sideways than a wide one).
* Earth hotspots (every sentence read from NASA first; see the facts below).
* The old plain "You landed" card remains for worlds without a picture (the Moon, for now).

## Facts for the dots (read from NASA on 2026-10-23)
* The aurora: "The Sun continuously produces an outflow of charged particles into the solar system known as the solar wind."; "When the solar wind reaches Earth, it can interact with Earth's magnetic shield"; "they can cause the colorful glow that we call auroras."; "The most common color is green, which is produced when oxygen is excited by electrons"; "southern lights (aurora australis)" (science.nasa.gov/sun/auroras/, and the photo's own record).
* Earth's air: "an atmosphere that consists of 78% nitrogen, 21% oxygen, and 1% other gases"; "shields us from much of the harmful radiation coming from the Sun." (science.nasa.gov/earth/facts/). That the bright band along the edge is the atmosphere's glow comes from NASA's caption of a sister photo, iss072e011489: "Earth's atmospheric glow blanketing the nighttime horizon".
* The clouds and the sea: the caption says "partly cloudy Indian Ocean"; "Earth's global ocean, which covers about 71% of the planet's surface" (science.nasa.gov/earth/facts/).
* The station: "traveling at a speed of five miles per second, orbiting Earth about every 90 minutes"; "In 24 hours, the space station makes 16 orbits of Earth, traveling through 16 sunrises and sunsets." (nasa.gov space station facts and figures, updated Jul 16, 2024). "8 solar arrays provide 75 to 90 kilowatts of power." The orange grid in the corner is described as "looks like one of the station's solar arrays", because the caption does not name it.
* This picture: the caption (269 miles, between Australia and Antarctica, June 12, 2025).

## What the build and the real-browser look changed (added while building)
* **On a wide screen the photo did not fill the window** (black bars either side). The camera now zooms in just enough that the screen sees exactly the photo's full width, and re-zooms when the screen changes shape (turning a phone). Tests: hand-worked values for 16:9 (45.75 degrees) and an 844x390 phone (38.23 degrees), a test that resizes the window after landing, and mutation checks.
* **Dots were behind Orbit** at the bottom of the photo and **the frame hid half the settings gear**: dots moved up and the gear raised above the frame.
* **At 420 px wide with the biggest text the long NASA credit made a tall narrow title card that ran into Orbit**: on narrow screens the title card now spans the full width under the buttons.
* My first "orange solar panel" test threshold was wrong (the panel is nearly black, about rgb(10,2,0) on screen). Calibrated against real pixels. A new test reads the finished picture and checks the aurora dot sits on green, the solar-array dot on the dark reddish panel, the cloud dot on bright cloud and the sky dot on dark sky; it catches a photo drawn at the wrong size.
* The photo is checked to be the right way round (the panel is in the lower right of the screen; a mirrored picture would put it lower left).
* Leftovers from earlier reviews done here: honest test timeouts (a 60 s wait inside a 30 s test), a flaky "changing your mind mid-flight" test that used fixed waits, and the Sun hook now says "99.8% of the solar system's mass" as NASA does.
* Known and left: on a small phone a dot can sit over the credit card or Orbit's bubble (cosmetic; with the biggest text on a 420 px phone a dot can be under the title card).

## What the PR review changed (added after review)
* **"You can never look past the edge of the photo" was false on a portrait phone.** Looking fully sideways and then up showed a black wedge in the top corner. Cause: a flat photo seen at an angle looks taller on screen by 1 / cos(angle), so "the photo's angle minus the screen's angle" is exact only along the middle row, not at the corners. Now `windowCornersInside` does the exact corner geometry (rays from the four screen corners meet the flat photo), the look limits are the largest range that keeps every corner on the photo, and the camera zooms a little more on a tall phone so the whole width of the photo can still be reached. Worked by hand for a 9:16 phone at 50 degrees: the old rule allowed 22.17 degrees sideways (top corner reaches 0.564 where the photo edge is 0.5); the true safe limit there is 10.87 degrees. A side finding: where the photo exactly fills a wide screen there is no room to look round at all (tilting pushes the top corners past the photo's sides), so a wide screen shows the whole photo and does not pan.
* An independent browser check paints the empty space magenta (test only) and counts magenta pixels after looking as far as possible in all directions on three phone shapes: 0 with the fix, 12,612 with the old rule restored.
* **The screen-reader label said "a real 360 degree photo ... taken by a NASA rover" for Earth.** Labels are now data (`description` in `surfaces.json`), validated, and tested to be true for each picture (Earth: astronaut photo, window, not 360, not a rover).
* The credit now also names the website NASA recommends (`eol.jsc.nasa.gov`); `CREDITS.md` records JSC's other requests (tell JSC about the use) and that JSC has not been told.
* Licensing: the PR reviewer noted the user's earlier "yes" covered NASA's media guidelines while this photo is under the JSC terms, and `CLAUDE.md` says licensing goes to the user first. The user has been asked to confirm; merge is on hold.
* Small: "8 main solar arrays" (NASA says new arrays are being added to the eight main ones); `wrapDegrees` can no longer return 360; a dead check removed. My own arithmetic error is recorded too: the exact zoom for a 16:9 screen is 45.747 degrees (I first wrote 45.78); the corner check correctly rejected the rounded number.

## Files touched
New: `public/textures/surfaces/earth-iss-*.jpg`, `e2e/surface-earth.spec.ts`, `decisions/...`. Changed: `public/data/surfaces.json`, `src/data/surfaces.ts`, `src/surface/*`, `src/ui/surfaceHud.ts`, `src/game.ts`, `src/style.css`, `tests/surfaceGeometry.test.ts`, `tests/surfaces.test.ts`, `e2e/surface.spec.ts`, `e2e/fly.spec.ts`, `CREDITS.md`, `ASSETS.md`, `README.md`.

## Skills / tools
`tdd` (the two kinds of seam already in use: pure geometry and content-data validation), `frontend-design` (window frame, same dots, cards and Orbit), `animation-performance` (dots still `transform`/`opacity` only; one textured plane), Playwright with repeat runs under load, Chrome for a real look.

## Risks
* **Licensing:** the terms are clear and permissive, and match the user's standing "use the NASA photos" decision. Still nobody has contacted NASA.
* A 4096 px photo is about 2.5 MB (loaded only on landing) and about 45 MB of video memory; unproven on a Chromebook (the 2048 px version is used for low quality).
* The photo is dark (night side). Dots need to stay readable (same dark outline as Mars; contrast re-checked).
* The sideways range depends on screen shape; very wide windows show thin black sides (hidden by the frame).

## Testing
* Vitest: new geometry (hand-worked values for a 24 mm lens), window limits, validator rules for `kind` and `photo`, dots sit on their features, credit and disclosure wording.
* Playwright: dock at Earth, picture visible, every dot opens its card, look range limited, keyboard and touch, Listen, Back to space, low quality image, frame does not block clicks, plus the existing tests updated for Earth no longer being a plain card. Repeat runs under load.
* Real look in Chrome and phone-sized screenshots with the biggest text.
