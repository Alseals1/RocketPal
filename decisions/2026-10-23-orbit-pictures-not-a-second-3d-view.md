# Orbit is shown as rendered pictures, not a second 3D view

**Decided by:** the main agent (routine). The user chose the design ("Yes, use your recommendation for Orbit", 2026-10-23).

## What
Orbit is built in Blender as a glTF model (`public/models/orbit.glb`, four faces as separate parts). The landing screen shows Orbit with three small transparent PNG portraits rendered from that model (neutral, happy, thinking), swapped by a `data-mood` attribute. The 3D model itself is not drawn anywhere in the game yet.

## Why
* A 64 px face does not justify a second WebGL view: another render context costs memory and speed on a school Chromebook, for no visible gain.
* Flat pictures cost nothing per frame, never block the game, and fail soft: if they do not load, Orbit's words (the speech bubble) are unchanged.
* The glb is still delivered and tested so a later feature (for example Orbit floating beside the ship) can use it, and the portraits and the model cannot drift apart because the pictures are rendered from the model.

## Mood rules
`thinking` while the picture loads, `neutral` after, `happy` from the first find to the end of that visit. A new visit starts again from `thinking`. Nothing moves, so there is no reduced-motion cost. No blinking yet.

## Alternatives
* Draw the 3D model live in a small second canvas: rejected (cost above).
* Keep the SVG face: rejected, it is not the agreed Orbit.
* Render the portraits as WebP: rejected, the tool on this Mac cannot write WebP and PNG at 36 KB each is small enough (three files, loaded only on landing).

## Cost
About 110 KB of pictures, loaded only when landing. The model file (56 KB) is not loaded by anything yet.
