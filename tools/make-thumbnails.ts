// Makes the Star Map's planet thumbnails (#42): one 128 x 128 WebP picture per world, written to public/thumbnails/.
// Each is drawn from the game's own procedural world texture (makeWorldTexture in src/scene/textures.ts), so the
// pictures are original work with no licence to approve (CREDITS.md, row `thumbnails`).
//
// Run with `node tools/make-thumbnails.ts` after changing makeWorldTexture or the drawing in tools/thumbnails.ts, then
// copy the printed sizes into src/assets/manifest.ts (tests/assetManifest.test.ts checks them).
// How: it starts Vite's dev server in code and opens tools/thumbnails.html in Playwright's Chromium, which paints each
// world on a canvas and returns it as WebP. Both are dev dependencies already, so no image package is needed
// (decisions/2026-11-21-planet-thumbnails.md). The bytes can differ a little between Chromium versions.
// Node runs this file directly (type stripping), so keep to plain, erasable TypeScript.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'thumbnails');

const server = await createServer({ root, configFile: false, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch();
try {
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not start');
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(e));
  await page.goto(`http://127.0.0.1:${address.port}/tools/thumbnails.html`);
  await page.waitForFunction(() => 'makeThumbnails' in window);
  const images = await page.evaluate(() => (window as unknown as { makeThumbnails(): Promise<Record<string, string>> }).makeThumbnails());
  mkdirSync(outDir, { recursive: true });
  for (const [id, dataUrl] of Object.entries(images)) {
    const prefix = 'data:image/webp;base64,';
    if (!dataUrl.startsWith(prefix)) throw new Error(`${id}: the browser did not make a WebP picture`);
    const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    writeFileSync(path.join(outDir, `${id}.webp`), bytes);
    console.log(`${id}: ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
  await server.close();
}
