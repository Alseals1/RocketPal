import { test, expect, type Browser, type Page } from '@playwright/test';

/** The renderer host (#31): starting quality, pixel ratio, `data-quality`, off-thread photos and a lost graphics context. */

interface DebugHandle {
  getShip(): { position: { x: number; y: number; z: number }; docked: boolean };
  getQuality(): string;
  getMode(): string;
  dockAt(id: string): void;
}

const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** A page on a computer that reports this much memory and this many cores, on a sharp (2x) screen. */
async function openOn(browser: Browser, hints: { memory: number; cores: number }, query = '') {
  const context = await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(({ memory, cores }) => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
  }, hints);
  await page.goto(`/?debug=1${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  return { context, page };
}

/** What the renderer was made with, read from the canvas itself. */
const canvasFacts = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    // Asking again returns three.js's own context, so these are the real attributes.
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext;
    return {
      antialias: gl.getContextAttributes()?.antialias,
      width: canvas.width,
      cssWidth: Math.round(canvas.getBoundingClientRect().width),
      dataQuality: document.documentElement.dataset.quality,
    };
  });

/** Drops or brings back the WebGL context, as a graphics driver reset would. */
const loseContext = (page: Page, how: 'loseContext' | 'restoreContext') =>
  page.evaluate((call) => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    // Kept on the page: once the context is lost, getExtension returns null.
    const w = window as unknown as { loseExt?: WEBGL_lose_context };
    w.loseExt ??= ext;
    w.loseExt[call]();
  }, how);

/** Counts bright and coloured pixels in the 3D picture (not the HTML on top). */
async function pictureStats(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = copy.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let bright = 0;
    let orange = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 16) {
      total++;
      const [r, gr, b] = [data[i], data[i + 1], data[i + 2]];
      if (Math.max(r, gr, b) > 180) bright++;
      if (r > 60 && r > gr * 1.1 && gr >= b) orange++;
    }
    return { bright, orangeShare: orange / total };
  });
}

test('a typical school Chromebook (4 GB, 4 cores) starts on low: no antialiasing, one pixel per CSS pixel', async ({ browser }) => {
  const { context, page } = await openOn(browser, { memory: 4, cores: 4 });
  expect(await debug(page, (h) => h.getQuality())).toBe('low');
  const facts = await canvasFacts(page);
  expect(facts.dataQuality).toBe('low');
  expect(facts.antialias).toBe(false);
  expect(facts.width).toBe(facts.cssWidth);
  await context.close();
});

test('a strong computer (8 GB, 8 cores) starts on high: antialiasing, and twice the pixels on a sharp screen', async ({ browser }) => {
  const { context, page } = await openOn(browser, { memory: 8, cores: 8 });
  const facts = await canvasFacts(page);
  expect(facts.antialias).toBe(true); // chosen when the renderer was made, so it shows the starting quality
  // Software drawing at 2x is slow, so the frame-rate check may already have dropped it to low: the two must agree.
  expect(facts.width).toBe(facts.cssWidth * (facts.dataQuality === 'high' ? 2 : 1));
  expect(await debug(page, (h) => h.getQuality())).toBe(await page.evaluate(() => document.documentElement.dataset.quality));
  await context.close();
});

test('the page address can force either quality, and <html data-quality> follows it', async ({ page }) => {
  for (const quality of ['low', 'high']) {
    await page.goto(`/?debug=1&quality=${quality}`);
    await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
    expect(await page.evaluate(() => document.documentElement.dataset.quality)).toBe(quality);
    expect(await debug(page, (h) => h.getQuality())).toBe(quality);
  }
});

test('if the graphics card drops the picture in space, the game waits with a friendly notice, then carries on', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/?debug=1&quality=high');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.keyboard.down('Space'); // boost, so a ship that kept flying would move a lot
  await expect.poll(async () => (await pictureStats(page)).bright).toBeGreaterThan(200);

  await loseContext(page, 'loseContext');
  const notice = page.getByTestId('context-lost');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('The picture stopped for a moment.');
  const restart = page.getByTestId('context-lost-restart');
  await expect(restart).toHaveText('Start again');
  expect((await restart.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(restart).not.toBeFocused(); // it never takes the keyboard away

  const before = await debug(page, (h) => h.getShip().position);
  await page.waitForTimeout(500);
  expect(await debug(page, (h) => h.getShip().position)).toEqual(before); // nothing flies on unseen
  await page.keyboard.up('Space');

  await loseContext(page, 'restoreContext');
  await expect(notice).toBeHidden();
  await expect.poll(async () => (await pictureStats(page)).bright, { timeout: 10_000 }).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('if the graphics card drops the picture on Mars, the photo draws again once it is back', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect.poll(async () => (await pictureStats(page)).orangeShare).toBeGreaterThan(0.5);

  await loseContext(page, 'loseContext');
  await expect(page.getByTestId('context-lost')).toBeVisible();
  await loseContext(page, 'restoreContext');
  await expect(page.getByTestId('context-lost')).toBeHidden();
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
  await expect.poll(async () => (await pictureStats(page)).orangeShare, { timeout: 10_000 }).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

test('"Start again" reloads the game', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.evaluate(() => ((window as unknown as { beforeReload?: boolean }).beforeReload = true));
  await loseContext(page, 'loseContext');
  await page.getByTestId('context-lost-restart').click();
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  expect(await page.evaluate(() => (window as unknown as { beforeReload?: boolean }).beforeReload)).toBeUndefined();
  await expect(page.getByTestId('context-lost')).toBeHidden();
});

test('landing photos are decoded off the main thread, and still face the right way', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.addInitScript(() => {
    const real = window.createImageBitmap.bind(window);
    const w = window as unknown as { bitmaps: number };
    w.bitmaps = 0;
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
      w.bitmaps++;
      return real(...args);
    }) as typeof createImageBitmap;
  });
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  const before = await page.evaluate(() => (window as unknown as { bitmaps: number }).bitmaps);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await page.evaluate(() => (window as unknown as { bitmaps: number }).bitmaps)).toBeGreaterThan(before);
  // The photo is drawn. Which way up it faces is checked by the pixel tests in surface*.spec.ts (dots sit on what they show).
  await expect.poll(async () => (await pictureStats(page)).orangeShare).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
