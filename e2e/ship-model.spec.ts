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
