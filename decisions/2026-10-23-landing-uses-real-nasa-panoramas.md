# Landing uses real NASA 360-degree photos

**Decided by:** the user chose the direction ("real or VR scene with real images from NASA"); the implementation choices below were made by the main agent.

## What
Landing on a world puts the player inside a real NASA panorama, wrapped round a sphere, looked at by dragging, swiping or keys. Mars comes first (Perseverance, PIA24264). Earth will use a real International Space Station hover view (the user's choice). Worlds with no surface (Sun, gas giants) get a real spacecraft photo as a hover view.

## Implementation choices (made by the main agent)
- **Bake once, not at runtime.** `tools/make-panorama.mjs` turns NASA's cylindrical photo into a standard 4096 x 2048 sphere picture plus a 2048 x 1024 low-quality one, committed to the repo. The game then only needs a plain sphere. Reproducible: the reviewer re-ran it and got identical bytes.
- **The photo only covers about +7 to -56 degrees**, so the rest is filled in from the photo's own edge colours. The screen says so ("The sky above and the dark ground below are filled in") and `CREDITS.md` describes it exactly.
- **Hotspot positions are stored as azimuth and elevation in degrees**, and a unit test checks them against the original photo's geometry.
- **Read-aloud now**, with the browser's built-in voice, because `CLAUDE.md` says every fact card has it (the original phase list said Phase 4).
- **Progress is not saved yet** (which dots were found): that is the later save/load feature.

## Alternatives considered
- Hotspots on the planet globe (cheapest, but does not feel like landing).
- A walkable placeholder surface scene (no real images; needs Blender models we do not have).
- A cylinder instead of a sphere (exact for this photo, but the sphere is the standard format for the other worlds' pictures).

## Licensing: the user decided
`CLAUDE.md` says licensing questions go to the user first. The user was asked (NASA's media guidelines say its content is generally not subject to copyright and allow educational use, but do not name games) and answered on 2026-10-23: **"Yes, use the NASA photos."** Recommendation, still open and not a blocker for `dev`: before anything is promoted to `main`, a human asks NASA directly (the guidelines page lists 202-358-1900). Credit is on screen beside the photo and in `CREDITS.md`.
