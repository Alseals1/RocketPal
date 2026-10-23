import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/** The parts of the `?debug=1` test handle used here. */
interface DebugHandle {
  getShip(): { speed: number; position: { x: number; y: number; z: number } };
  hasShipModel(): boolean;
  pickTarget(id: string): void;
  setAutopilot(on: boolean): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) =>
  page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

function watchForErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('the Blender rocket replaces the simple one, with no console errors', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.goto('/?debug=1');
  await expect.poll(() => debug(page, (h) => h.hasShipModel()), { timeout: 20_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('if the rocket file cannot be loaded, the simple rocket stays and the game still flies', async ({ page }) => {
  // The browser reports the blocked file as a console error by itself; that one is expected here.
  const errors = watchForErrors(page, [/Failed to load resource/]);
  await page.route('**/models/ship.glb', (route) => route.abort());
  await page.goto('/?debug=1');
  await expect(page.locator('#game-canvas canvas')).toBeVisible();

  await debug(page, (h) => {
    h.pickTarget('moon');
    h.setAutopilot(true);
  });
  const start = await debug(page, (h) => h.getShip().position);
  await expect
    .poll(
      async () => {
        const now = await debug(page, (h) => h.getShip().position);
        return Math.hypot(now.x - start.x, now.y - start.y, now.z - start.z);
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(1);

  expect(await debug(page, (h) => h.hasShipModel())).toBe(false);
  expect(errors).toEqual([]);
});

/** Files that arrive fine from the network but are not a usable rocket: the game must treat each like a missing file. */
const goodFile = readFileSync('public/models/ship.glb');
const brokenFiles: Record<string, { body: Buffer | string; contentType: string; warning?: RegExp }> = {
  'cut off half way': { body: goodFile.subarray(0, 20_000), contentType: 'model/gltf-binary' },
  'garbage': { body: Buffer.from('this is not a model at all'), contentType: 'model/gltf-binary' },
  // What a website serves for a missing file when it answers every address with its home page.
  'a web page instead': { body: '<!doctype html><title>Not found</title>', contentType: 'text/html' },
  // A real model, but its flame part is called something else, so the game cannot find it.
  'no part called Flame': {
    body: Buffer.from(goodFile.toString('latin1').replace('"Flame"', '"Flamx"'), 'latin1'),
    contentType: 'model/gltf-binary',
    // Fails for the right reason: the game says what was missing.
    warning: /Flame/,
  },
};

for (const [what, { warning, ...file }] of Object.entries(brokenFiles)) {
  test(`a rocket file that is ${what} leaves the simple rocket in place and the game still flies`, async ({ page }) => {
    const errors = watchForErrors(page, [/Failed to load resource/]);
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.route('**/models/ship.glb', (route) => route.fulfill({ status: 200, ...file }));
    await page.goto('/?debug=1');
    await expect(page.locator('#game-canvas canvas')).toBeVisible();

    await debug(page, (h) => {
      h.pickTarget('moon');
      h.setAutopilot(true);
    });
    const start = await debug(page, (h) => h.getShip().position);
    await expect
      .poll(
        async () => {
          const now = await debug(page, (h) => h.getShip().position);
          return Math.hypot(now.x - start.x, now.y - start.y, now.z - start.z);
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(1);

    // Give a late failure time to show up, then check nothing swapped in and nothing broke.
    await page.waitForTimeout(500);
    expect(await debug(page, (h) => h.hasShipModel())).toBe(false);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /Rocket model not loaded/.test(w) && (warning?.test(w) ?? true))).toBe(true);
  });
}
