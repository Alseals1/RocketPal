# Asset manager and manifest

Date: 2026-11-13. Decided by the Plan agent for issue #40 and built by the Implement agent. Items 11 to 13 were small changes made during the build. A person can overrule any line at PR review. The code is in `src/platform/assets.ts`, `src/assets/manifest.ts` and `src/render/assetLoaders.ts`. The interfaces are in `docs/TECHNICAL_ARCHITECTURE.md` section 4.15.

## What was decided
1. **The manager lives in `src/platform/assets.ts`, where 4.15 puts it, and never imports `three`.** `AssetEntry` and `AssetManager` are copied exactly. `RefCountedAssetManager` does the counting, the choice of file, the logging, the restore hook and preload. The render layer supplies one loader per asset type (`textureLoader`, `modelLoader` in `src/render/assetLoaders.ts`), and the app wires them together in `createGameAssets` (`src/app/rendering.ts`). This is the pattern `createAudioManager` uses with its injected Howler loader (decisions/2026-11-12-platform-services.md item 5), and the manager is unit-tested with fake loaders.
2. **`src/assets/` is mapped to the Platform layer** in `tests/architecture.test.ts`. Section 3's diagram already lists "assets" under platform. No layer rule changed.
3. **`credit` is an id in a new first Id column of `CREDITS.md`** (`mars-jezero`, `earth-iss`, `ship`, `orbit`, `procedural`). Section 4.15 already says "a CREDITS.md entry id"; this adds the ids. The manifest test checks that the row lists every file of the entry.
4. **Byte budgets** (`ASSET_BUDGET_BYTES`): texture 1,500,000 high and 600,000 low; model 500,000; image 200,000; sound 500,000; font 200,000. The 2048 px texture limit and the 15 MB first-play budget stay where they are (CLAUDE.md, `e2e/first-play-size.spec.ts`).
5. **`acquire` rejects on failure, and each caller keeps its own fallback**: the plain landing card for a photo, the placeholder rocket for the ship. Both are today's behaviour with existing browser tests. `AssetLoadError` carries the id and URL.
6. **Logging:** one `console.warn` per id per session, by the manager. Each new `acquire` tries the file again (a network blip must not cost the photo for the rest of the run) but does not log again. Callers do not log an `AssetLoadError` a second time.
7. **`preload` only warms the HTTP cache** at idle priority: no decode, no users, errors swallowed. Nothing calls it yet; preloading a photo when a target is picked would break the "nothing is downloaded before landing" tests (#31) and is a product call.
8. **Quality is fixed when an asset is acquired.** `prefersLow()` is `quality === 'low' || maxTextureSize < 4096` (`prefersLowAssets`, which replaces `photoSize`). An asset already held keeps its size until it is freed.
9. **The window-view rule is data.** `photo/earth` lists only `earth-iss-2048.jpg`. `earth-iss-4096.jpg` stays on disk and in `CREDITS.md`, but not in the manifest.
10. **Freeing is synchronous on the last release** (the texture's `dispose()` and its `ImageBitmap.close()`; every geometry, material and material texture of a model). A release during a load frees the value when it arrives. After `webglcontextrestored`, held and loaded assets are marked `needsUpdate`; a held texture's bitmap is never closed, so three.js can upload it again.
11. **Render loaders do not name `AssetLoader` (build change).** Render may not import Platform (section 3), which the plan missed. The loaders are plain objects with the same shape, and `createGameAssets` hands them to the manager, where TypeScript checks them structurally.
12. **`ArrivalScreen` drops its `visiting` flag (build change).** A picture that arrives after the player has left now just releases its own hold. If the player has already landed on the same world again, that visit shares the one texture and keeps it; otherwise the release frees it.
13. **`game.ts` stays under the 150-line guard (build change)** by folding the three stage-creation lines into one.

## Why
- Later work (#43 world textures, #52, #22) needs one place that knows each asset's size, credit and users, so GPU memory is freed when a screen is left and a lost context is survived. Keeping `three` out of platform keeps the layer rules and makes the counting testable without WebGL.

## Alternatives
- **Manager in `src/render/` with `three` imports:** moves a 4.15 type out of its named home and needs a section 4 decision.
- **Manager resolves a stand-in value on failure:** a photo has no sensible stand-in today (the browser test wants the landing card), and callers would have to tell real from fake.
- **A generated-texture fallback inside the manager:** no texture user needs one yet. It comes with the first that does (#43), per section 11.
- **`credit` matched by file path, with no ids:** works, but leaves "a CREDITS.md entry id" untrue.
- **Caching a failed id for the session:** one blip would cost the photo for the whole run.
- **`preload` that decodes and holds:** GPU memory with no owner and no release.
