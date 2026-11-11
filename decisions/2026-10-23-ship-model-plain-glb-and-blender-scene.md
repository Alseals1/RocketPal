# Ship model: plain .glb, built in a separate Blender scene

**Decided by:** the main agent (routine decisions). The user chose "Blender models first" (2026-10-23).

## What
1. The rocket ship (`public/models/ship.glb`) is exported as a plain `.glb`, not Draco or meshopt compressed.
2. It was built in a **new scene** (`RocketPals_Ship`) inside the user's already-open Blender file, not in that file's own scene.
3. The editable source is saved in the repo as `assets-src/ship.blend` (only the ship, no other scene content).
4. The game loads the model after the first frame and keeps the old simple rocket if loading fails.

## Why
1. The file is 37 KB. Draco's decoder (hundreds of KB) would be bigger than the whole model, so compression would make first play heavier, not lighter. `CLAUDE.md` asks for "compressed glTF" for models in general; this is the exception that follows its goal (small first play, under 15 MB). Bigger models later should be compressed.
2. The open Blender file (`~/Untitled.blend`) held an unsaved crystal scene. Wiping or editing it could lose the user's work. A separate scene leaves everything else alone; the ship scene is removed from that file when the feature is done.
3. A source file lets anyone change the model later without rebuilding it.
4. Loading late keeps first paint fast; the fallback means a kid never sees an error screen.

## Alternatives
* Draco/meshopt now: larger download than saving, extra decoder code. Rejected.
* Ask the user to open a fresh Blender file: safest, but it costs the user a step and the separate scene is just as safe.
* Build in the user's own scene: risks their work. Rejected.

## Cost
`GLTFLoader` adds some code to the game's JavaScript bundle (not measured separately; the whole built game is checked against the 15 MB budget).
