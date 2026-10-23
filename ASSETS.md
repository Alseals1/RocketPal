# Assets still needed

Blender MCP tools were **not available** in the Claude Code session that set up this project, so the game uses simple placeholder shapes (spheres, cones) until the models below exist.

**How to get them built:** connect the Blender MCP to Claude Code (see `README.md`), or take this list to your Claude desktop chat where Blender is connected. Export each as compressed glTF (`.glb`, Draco or meshopt) to the target path. Style for all models: bright, rounded, friendly, chunky shapes, no sharp edges, flat-ish colors with a colorblind-safe palette, no scary details.

## Models

| Name | Purpose | Polygon budget | Target path | Style notes |
| --- | --- | --- | --- | --- |
| Rocket ship | Player ship (flight, landing) | 3,000 tris | `public/models/ship.glb` | Small, rounded, big cockpit window, 3 swappable color trims for upgrades; engine flame as separate node. |
| Rover | Surface driving on Mars/Moon | 2,500 tris | `public/models/rover.glb` | Chunky wheels, small antenna, friendly face-like front. |
| Astronaut | Surface exploring | 2,500 tris | `public/models/astronaut.glb` | Round helmet, big visor, waving idle pose. |
| Orbit (robot guide) | Narrator, appears on every screen | 3,000 tris | `public/models/orbit.glb` | Floating round body, two big eyes (blink, happy, thinking), tiny antenna. |
| Flag | Planted on each landing | 300 tris | `public/models/flag.glb` | Simple pole and flag. |
| Comet | Random event | 800 tris | `public/models/comet.glb` | Glowing rock with soft tail card. |
| Satellite | Earth orbit prop / Easter egg | 1,200 tris | `public/models/satellite.glb` | Two panels, small dish. |
| Asteroid x3 variants | Asteroid Dodge mini-game | 400 tris each | `public/models/asteroid_{a,b,c}.glb` | Lumpy, cute, not menacing. |
| Sticker icons | Journal badges (10 worlds) | n/a | `public/textures/badges/*.png` (256 px) | Flat icon per world, outlined. |

## Textures (not yet downloaded)

Procedural textures are used as placeholders. Real textures must have a licence recorded in `CREDITS.md` before use. Target: 2048 px max (1024 px for far planets), JPG or KTX2, lazy-loaded, in `public/textures/`.

| Name | Target path | Notes |
| --- | --- | --- |
| Sun, Mercury, Venus (surface + cloud), Earth (day, clouds), Moon, Mars, Jupiter, Saturn (+ ring alpha), Uranus, Neptune | `public/textures/<world>.jpg` | Source and licence to be chosen and verified (NASA imagery or an openly licensed set). |
| Star field / Milky Way | `public/textures/stars.jpg` | Optional; the game can use generated points. |

## Real NASA images for the other worlds (decided 2026-10-23, not yet researched or downloaded)

Landing on a world shows a real NASA photograph (see `plans/mars-panorama.md`). Mars is done. Each other world needs its own picture; every one must have its credit line and licence checked and recorded in `CREDITS.md` before use, and be turned into the sphere picture format with `tools/make-panorama.mjs` (4096 x 2048 and a 2048 x 1024 version, panoramas only may be 4096 wide).

| World | What to show | Notes |
| --- | --- | --- |
| Earth | **A real hover view from the International Space Station** (chosen by the user), for example the Earth below from the Cupola or an astronaut photograph | Look for a real 360 degree or very wide ISS panorama; if none is openly usable, build the view from a real NASA ISS photograph of Earth. Credit and licence to verify. |
| The Moon | An Apollo lunar surface panorama (for example Apollo 17 or Apollo 11 mosaics) | Several are cylindrical or scrolling, not sphere pictures: check the projection first. **Do not use** artist-made "VR360 Moon" sets sold online; they are not NASA photographs. |
| Mercury | A real MESSENGER image of the surface or the planet | No ground photos exist; hover view. |
| Venus | A real NASA mission image of the clouds or a radar view (Magellan) | No NASA surface photos; the only surface photos were taken by Soviet landers (not NASA). Hover view. |
| Jupiter, Saturn, Uranus, Neptune | A real spacecraft photograph (Juno, Cassini, Voyager 2) as a hover view | No surface to land on. |
| The Sun | A real Solar Dynamics Observatory image | No surface to land on. |

## Audio (Phase 4)

| Name | Target path | Notes |
| --- | --- | --- |
| Music loops (calm space, flying, quiz) | `public/audio/music_*.ogg` | Must be originals or openly licensed; record in `CREDITS.md`. |
| Effects (boost, land, correct, retry, star, badge) | `public/audio/sfx_*.ogg` | Gentle, no jump scares. |
