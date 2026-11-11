import { test, expect } from '@playwright/test';

// Deliberately failing test: proves the CI check goes red. Reverted in the next commit.
test('CI proof: this test must fail', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Not Rocket Pals', { timeout: 2000 });
});
