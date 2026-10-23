# Feature: mars-panorama (prototype)

Branch: `feature/mars-panorama` (cut from `dev`). First slice of Phase 2 "Land and learn", built as a prototype on **one real NASA panorama of Mars** to prove the idea before the other worlds.

## Goal
When the rocket docks at Mars, the kid is "standing" inside a real photograph of Mars (Perseverance's first 360° panorama from Jezero Crater), looks around by dragging, swiping, or the arrow keys, taps glowing dots to read short NASA-checked fact cards, can have each card read aloud, and flies back to space. Done = that works on keyboard, touch, and tap/click-only; it runs well; credit to NASA is on screen and in `CREDITS.md`.

## Decisions made with the user
* Landing = a 360° look-around ("VR style", no headset) using **real NASA images**.
* Panorama images may be **4096 px wide** (the 2048 px texture cap stays for everything else). Low-quality mode loads a 2048 px version.
* **Earth** will use a real hover view from the International Space Station (later feature, not this prototype).
* Other worlds with no surface (Sun, gas giants) will use real spacecraft photos as hover views (later).

## The image
* Source: **PIA24264**, "Mastcam-Z's First 360-Degree Panorama", Perseverance rover, Sol 3 (Feb 21, 2021), 142 images stitched, 9238 x 2451 px JPEG, 2.7 MB. Credit line: "NASA/JPL-Caltech/MSSS/ASU". Page: https://science.nasa.gov/photojournal/mastcam-zs-first-360-degree-panorama/ (it states no restrictions beyond NASA's media guidelines: generally not copyrighted; credit NASA; no NASA logo; no implied endorsement). "Game" use is not named in the guidelines (educational "computer graphical simulations" is), so a human may want to confirm with NASA. Full record in `CREDITS.md`.
* It only covers the horizon band (about +8 to -57 degrees, cylindrical projection), so `tools/make-panorama.mjs` pre-bakes it once into a standard 360 x 180 degree image: the photo placed with the right geometry, real sky colours continued upward, and dark ground below. Outputs: `public/textures/surfaces/mars-jezero-4096.jpg` and `-2048.jpg`. The script is committed so the steps can be repeated or checked. Only resizing and re-projecting; the photo content is not edited.

## Approach
* `src/surface/geometry.ts` (pure): azimuth/elevation to a direction and back, cylindrical photo coordinates to azimuth/elevation (so hotspots can be placed by pointing at the original photo), looking-around motion (turn, tilt limits, wrap-around).
* `src/data/surfaces.ts` + `public/data/surfaces.json`: per world: image files, credit line, start direction, hotspots (position, short title, 1-3 short sentences, source URL, `lastChecked`), validated like `planets.json`.
* `src/surface/panoramaScene.ts`: Three.js sphere seen from the inside, shares the game's renderer; low quality uses the 2048 image. `src/surface/look.ts`: drag/swipe/arrow-key look controls.
* `src/ui/surfaceHud.ts`: glowing hotspot dots that follow the picture (transform/opacity only), "Found N of M", **Orbit** (the robot guide, as a simple drawn face for now) with a one-sentence hint, the fact card with a big **Listen** button, **Back to space**, and the photo credit.
* `src/audio/speech.ts`: read-aloud with the browser's built-in voice; Listen / Stop; stops when the card closes; says so plainly if the computer has no voice.
* `Game`: after docking at a world that has a surface scene, switch to it instead of the old "You landed" card; "Back to space" does what "Fly again" did. Worlds without a surface scene keep the old card for now.
* Facts (all read from NASA pages on 2026-10-23): Perseverance is searching for signs of ancient life and collecting core samples of rock (science.nasa.gov/mission/mars-2020-perseverance); Jezero Crater: more than 3.5 billion years ago river channels spilled over the crater wall and created a lake; the far hills are the rim of Jezero Crater (PIA24264 page); Mars looks red because iron minerals in the dirt rust (science.nasa.gov/mars/facts); the sky would look hazy and red from floating dust (same page); this picture was stitched on Earth from 142 images taken on Sol 3.
* Visits (which dots you have tapped) are kept in memory only for now; saving progress is a later feature.

## What the build and the real-browser look changed (added while building)
* The photo has a thin black border at its top and bottom edge. Sampling the sky colour inside it made the whole sky black; fixed by measuring the border rows and cutting them off (the numbers are in the script). A second bug put a black band at the seam (the blend zone mixed in ground colour instead of sky colour); fixed and checked by zooming on the seam.
* The first version of the fact card stretched to the full screen height; fixed. On a 420 px phone with the biggest text the title card, the Back button, and the settings gear collided, and a long credit line poked out of its card; fixed, each with a test that fails without the fix.
* The Mac this was built on reported 199 voices; the Listen button worked with a real voice. A Chromebook voice is untested.
* Looking down is limited to -60 degrees (straight down is only dark shadow under the rover).
* A debug-only shortcut (`?debug=1`, `dockAt`) docks at a world instantly so most browser tests do not need a 15 second flight; one test still flies there on autopilot.

## Files touched
New: `tools/make-panorama.mjs`, `public/textures/surfaces/*.jpg`, `public/data/surfaces.json`, `src/data/surfaces.ts`, `src/surface/*`, `src/ui/surfaceHud.ts`, `src/audio/speech.ts`, `tests/surfaces.test.ts`, `tests/surfaceGeometry.test.ts`, `e2e/surface.spec.ts`. Changed: `src/game.ts`, `src/style.css`, `CREDITS.md`, `README.md`.

## Skills / tools
`tdd` (pure geometry and data validation: these are extensions of the seam types already agreed with the user for `planets.json` validation and the scale/readout maths; the user has not yet confirmed any further seams, so none beyond those two kinds are used), `frontend-design` (dots, cards, Orbit), `animation-performance` (dots use transform and opacity only; no layout reads per frame; the look-around is one textured sphere), Playwright, Chrome tools for a real look and a frame-rate reading, `grill-me` (the questions to the user about landing style and read-aloud).

## Risks
* The photo is a **rover selfie**: the rover deck fills much of the lower half. Good for tapping, but it is not a clean landscape.
* The cylindrical-to-sphere maths is a best reading of the projection (NASA's page does not name it): checked by eye against the original (straight vertical edges, no mirroring).
* A 4096 x 2048 texture is about 45 MB of video memory with mipmaps: fine for a Chromebook? Unproven; the 2048 version is the fallback and low quality uses it automatically.
* Read-aloud voices differ by computer; a Chromebook voice is untested.
* NASA's "game" use question (above) is for a human to confirm.

## Testing
* Vitest: geometry (round trips, known directions, pixel-to-angle examples), look controls (limits, wrap-around), `surfaces.json` validation (every hotspot has a short title and short text, source, `lastChecked`; angles in range; files named exist).
* Playwright: dock at Mars, the surface scene appears and is not blank (reddish pixels), every dot opens a card with its text and a Listen button, Found counter, Back to space works, keyboard look-around and tapping a dot with Enter, touch drag, low quality loads the small image, no console errors.
* Real look in Chrome: screenshots at several headings, orientation check against the original photo, frame rate on this Mac.
