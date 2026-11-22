# Planet thumbnails for the Star Map

Date: 2026-11-21. Decided by the Plan agent for issue #42 and built by the Implement agent (part 1 of 3). A person can overrule any line at PR review. The code is in `tools/make-thumbnails.ts`, `tools/thumbnails.ts` and `tools/thumbnails.html`; the files are in `public/thumbnails/`.

## What was decided
1. **One 128 x 128 WebP picture per world** (Sun, eight planets, Moon), at `public/thumbnails/<worldId>.webp`. The Star Map (`docs/VISUAL_DESIGN.md` 7.4) shows them in its nodes. 128 px covers a node of up to 64 CSS px on a 2x screen. WebP quality 0.85 gives about 2 to 6 KB each (29 KB for all ten), far under the 200 KB `image` budget.
2. **Drawn from the scene's own textures.** Each is a disc cut from `makeWorldTexture(world)` (`src/scene/textures.ts`), half the texture's width across it (one face of the sphere), shaded as if lit from the upper left with a dark-blue night side (7.2: never pure black). Saturn gets a simple ring; the Sun gets a soft glow and no shading. The pictures are original work, so there is no licence question (`CREDITS.md` row `thumbnails`).
3. **Made by a committed script that uses tools already in the repo.** `node tools/make-thumbnails.ts` starts Vite's dev server in code (`createServer`), opens the dev-only page `tools/thumbnails.html` in Playwright's Chromium, which paints each world on a canvas and returns `toDataURL('image/webp', 0.85)`, and writes the files. Both `vite` and `@playwright/test` are dev dependencies already. This is the same approach as `tools/make-panorama.mjs`.
4. **Listed in the asset manifest** as `thumb/<worldId>`, type `image`, with exact byte sizes; `thumbnailId(worldId)` names them. The test checks every world has one, and that each file is a 128 x 128 WebP (it reads the header).
5. **Re-run the script when the look changes:** after a change to `makeWorldTexture`, or when real planet textures arrive (#22's `WorldLook`), run `node tools/make-thumbnails.ts` and copy the printed sizes into `src/assets/manifest.ts`. The bytes can differ a little between Chromium versions, so the test checks the format and size, not the bytes.

## Why
- The Star Map needs a small picture per world without pulling `three` into the UI layer or drawing ten textures at run time.

## Alternatives
- **`sharp` or another image package:** a new dependency, which is a gate hit, for something the browser already does.
- **Drawing thumbnails live in the browser:** the issue asks for WebP files in the manifest, and the Star Map (UI layer) would then need `three`.
- **PNG:** two to four times bigger for the same look.
