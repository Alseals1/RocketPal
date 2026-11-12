# Renderer host, starting quality and Chromebook readiness

Date: 2026-11-12. Decided by the Plan agent for issue #31 and approved at plan review (answers 1A, 2A and D on the issue); built by the Implement agent.

## What was decided
1. **A device starts on low at 4 GB of memory or less, or 4 cores or less** (`LOW_MEMORY_GB`, `LOW_CORES` in `src/quality/quality.ts`). These are defaults: #28 has not measured a Chromebook yet. A person fills in the "Before and after #31" table in `docs/PROGRESS.md` on a Chromebook before merge, and the two constants are tuned in a follow-up if the numbers say so. A browser that reports neither still starts on high.
2. **Antialiasing is fixed at the start.** It can only be chosen when the `WebGLRenderer` is made, so it follows the starting quality. When the frame-rate check drops to low later, the pixel ratio goes to 1 at once and the drawing buffer is resized, but antialiasing stays on. Low means no antialiasing and pixel ratio 1; high means antialiasing and at most 2.
3. **A window view always uses the 2048 photo** (`photoSize` in `src/quality/quality.ts`), at both qualities: the photo fills only part of the view. A 360 degree photo gets the 4096 one only at high quality on a card that can hold it, as before. `public/textures/surfaces/earth-iss-4096.jpg` is now unused but stays: it is never downloaded, so it costs nothing at first play. Removing it is a person's call.
4. **Photos decode off the main thread** through `THREE.ImageBitmapLoader` with `imageOrientation: 'flipY'` (three.js ignores `texture.flipY` for bitmaps). If `createImageBitmap` is missing or the bitmap load fails, `TextureLoader` is used instead.
5. **On a lost WebGL context the game waits.** three.js already skips drawing while the context is lost and re-uploads textures and geometry on restore. The game stops updating screens (nothing flies on unseen) and shows "The picture stopped for a moment." with a "Start again" button that reloads the page. No timer and no automatic reload. The photo's `ImageBitmap` is closed only when the picture is disposed (on leave), never earlier, so a restore can upload it again.
6. **`WebRendererHost` implements the 4.14 `RendererHost` interface unchanged.** Its extras (`resize`, `isContextLost`, `dispose`, and the constructor options for tests) live on the class only. The app shell uses the class; screens see only the interface.
7. **`ScreenContext.renderer` (the 4.11 name) replaces the `quality()` stand-in**, which becomes `renderer.quality`. `scene` stays as "the space picture" until `RenderScene` (4.14) arrives with its first user.
8. **`<html data-quality="high|low">`** is set by the host when it is made and on every change, so CSS can follow the quality later. No CSS uses it yet.
9. **Stack of two PRs (answer D).** #32 parts 2 and 3 had merged into their stack branches, not `dev`, and #38 changed `src/game.ts` after #32 split it. Part 1 (`goat/31-1-land-32`) lands #32 on `dev` and carries #38's `Content` into the split files; part 2 (`goat/31-2-renderer-host`) is this plan.

## Why
- The thresholds: most school Chromebooks have 4 GB and 4 cores, and today they start on high with antialiasing and pixel ratio 2. The constants are one line each to tune once real numbers are in.
- Fixing antialiasing at the start avoids rebuilding the renderer, which would mean a new context, re-uploading everything and re-attaching every canvas listener. Cutting the pixel ratio from 2 to 1 already removes three quarters of the pixels.
- A rule in code for `kind: 'window'` covers the future fly-by worlds that use the window view too (architecture 5.10), not just Earth.
- Reloading automatically on a lost context would lose unsaved state, and all of it when storage is blocked.

## Alternatives
- **Rebuild the `WebGLRenderer` on a run-time drop to turn antialiasing off:** high risk for a one-time saving (see Why).
- **Always start without antialiasing:** a visible quality loss on capable machines that the numbers do not justify yet.
- **Point Earth's `images.high` at the 2048 file in `surfaces.json`:** fixes Earth only.
- **Reload the page automatically on a lost context:** loses state (see Why).
- **Put `resize`, `isContextLost` and `dispose` on the 4.14 interface:** changes a shared type for members only the app shell needs.
