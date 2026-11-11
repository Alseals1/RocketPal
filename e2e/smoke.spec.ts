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
