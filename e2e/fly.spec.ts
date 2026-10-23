import { test, expect, type Page } from '@playwright/test';

/** The test handle that `?debug=1` adds to the page. */
interface DebugHandle {
  getShip(): { yaw: number; pitch: number; speed: number; docked: boolean; position: { x: number; y: number; z: number } };
  getTargetId(): string | null;
  getQuality(): string;
  isGlowVisible(): boolean;
}
const ship = (page: Page) => page.evaluate(() => (window as unknown as { rocketPals: DebugHandle }).rocketPals.getShip());
const handle = <T>(page: Page, fn: (h: DebugHandle) => T) =>
  page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function start(page: Page, query = '') {
  await page.goto(`/?debug=1&quality=high${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
}

test('draws the solar system with no console errors', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);

  await expect(page.locator('#game-canvas canvas')).toBeVisible();
  const box = await page.locator('#game-canvas canvas').boundingBox();
  expect(box!.width).toBeGreaterThan(300);
  // A picture full of stars and planets is far bigger than a blank one.
  expect((await page.locator('#game-canvas canvas').screenshot()).length).toBeGreaterThan(15_000);

  // The game loop is running: the rocket flies forward by itself.
  const before = await ship(page);
  await page.waitForTimeout(500);
  const after = await ship(page);
  expect(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('keyboard steers, pitches, and boosts', async ({ page }) => {
  await start(page);
  const start0 = await ship(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  expect((await ship(page)).yaw).toBeLessThan(start0.yaw - 0.3); // turning right lowers the yaw angle

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  expect((await ship(page)).pitch).toBeGreaterThan(start0.pitch + 0.3);
  await page.keyboard.up('KeyW');

  await page.keyboard.down('Space');
  await page.waitForTimeout(2000);
  expect((await ship(page)).speed).toBeGreaterThan(100);
  await page.keyboard.up('Space');
});

test('tap-only: pick Mars, tap Autopilot, and land', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchForErrors(page);
  await start(page);

  await expect(page.locator('[data-testid="autopilot-button"]')).toBeHidden(); // nothing to fly to yet
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Mars' }).click();

  await expect(page.locator('.stats-title')).toHaveText('Flying to Mars');
  await expect(page.locator('.stats')).toContainText('million km to go');
  await expect(page.locator('.stats')).toContainText('Light needs');
  await expect(page.locator('.stats')).toContainText('Pretend speed');
  await expect(page.locator('.stats')).toContainText('Real rockets are much slower');

  await page.getByTestId('autopilot-button').click();
  await expect(page.getByTestId('landed')).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('#landed-title')).toHaveText('You landed on Mars!');
  expect((await ship(page)).docked).toBe(true);

  // Fly again: the rocket lifts off and Mars is now "you're here".
  await page.getByTestId('fly-again').click();
  await expect(page.getByTestId('landed')).toBeHidden();
  expect((await ship(page)).docked).toBe(false);
  await page.getByTestId('where-button').click();
  await expect(page.getByRole('button', { name: /Mars/ })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('steering by hand takes over from autopilot', async ({ page }) => {
  await start(page);
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Neptune' }).click();
  await page.getByTestId('autopilot-button').click();
  await expect(page.getByTestId('autopilot-button')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowLeft');
  await expect(page.getByTestId('autopilot-button')).toHaveAttribute('aria-pressed', 'false');
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('shows the stick and boost button, and they fly the rocket', async ({ page }) => {
    await start(page, '&touch=1');
    const stick = page.getByTestId('stick');
    const boost = page.getByTestId('boost-button');
    await expect(stick).toBeVisible();
    await expect(boost).toBeVisible();

    const s = (await stick.boundingBox())!;
    const before = await ship(page);
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width / 2 + 60, s.y + s.height / 2 - 30, { steps: 4 }); // right and up
    await page.waitForTimeout(600);
    const steered = await ship(page);
    await page.mouse.up();
    expect(steered.yaw).toBeLessThan(before.yaw - 0.2);
    expect(steered.pitch).toBeGreaterThan(before.pitch + 0.1);

    const b = (await boost.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    expect((await ship(page)).speed).toBeGreaterThan(100);
    await page.mouse.up();
  });

  test('every button is a big, easy target (56 px or more)', async ({ page }) => {
    await start(page, '&touch=1');
    await page.getByTestId('where-button').click();
    const buttons = [page.getByTestId('where-button'), page.getByTestId('boost-button'), ...(await page.locator('.world-button').all())];
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect(box.height, await button.innerText()).toBeGreaterThanOrEqual(56);
      expect(box.width).toBeGreaterThanOrEqual(56);
    }
    await page.getByRole('button', { name: 'Earth' }).click();
    expect((await page.getByTestId('autopilot-button').boundingBox())!.height).toBeGreaterThanOrEqual(56);
  });
});

test('low quality mode turns glow off; high quality has it on', async ({ page }) => {
  await start(page);
  expect(await handle(page, (h) => h.getQuality())).toBe('high');
  expect(await handle(page, (h) => h.isGlowVisible())).toBe(true);

  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  expect(await handle(page, (h) => h.getQuality())).toBe('low');
  expect(await handle(page, (h) => h.isGlowVisible())).toBe(false);
});

test('works with reduced motion switched on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = watchForErrors(page);
  await start(page);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
