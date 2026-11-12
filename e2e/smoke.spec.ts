import { test, expect } from '@playwright/test';

test('game page loads with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Rocket Pals');
  await expect(page.locator('h1')).toHaveText('Rocket Pals');
  await expect(page.locator('#game-canvas')).toBeAttached();
  expect(errors).toEqual([]);
});

for (const query of ['?debug=0', '?debug', '?debug=true']) {
  test(`${query} does not turn on the debug handle`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`/${query}&quality=high`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible();
    await expect(page.getByTestId('where-button')).toBeVisible(); // the game has started
    expect(await page.evaluate(() => (window as unknown as { rocketPals?: unknown }).rocketPals)).toBeUndefined();
    expect(errors).toEqual([]);
  });
}

test('?debug=1 turns on the debug handle', async ({ page }) => {
  await page.goto('/?debug=1&quality=high');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
});
