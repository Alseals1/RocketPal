import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';

/**
 * Baseline screenshots for docs/visual-baseline/ (docs/VISUAL_DESIGN.md section 12). Not compared in CI:
 * software WebGL differs between computers, so a person compares them by eye.
 *
 *   UPDATE_VISUAL_BASELINE=1 npx playwright test e2e/visual-baseline.spec.ts
 *
 * VISUAL_BASELINE_DIR changes where they go (for example a git-ignored folder, to compare two commits).
 */
const OUT = process.env.VISUAL_BASELINE_DIR ?? 'docs/visual-baseline/m3';
const SIZES = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];

test.skip(!process.env.UPDATE_VISUAL_BASELINE, 'Only when UPDATE_VISUAL_BASELINE=1');

const debug = (page: Page, script: string) => page.evaluate(`window.rocketPals.${script}`);

async function start(page: Page) {
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);
  await page.waitForTimeout(800);
}

const shot = (page: Page, size: { width: number; height: number }, screen: string) =>
  page.screenshot({ path: `${OUT}/${size.width}x${size.height}-${screen}.jpg`, type: 'jpeg', quality: 60 });

for (const size of SIZES) {
  test(`today's screens at ${size.width}x${size.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize(size);

    await start(page);
    await shot(page, size, 'start');

    await page.getByTestId('where-button').click();
    await page.waitForTimeout(300);
    await shot(page, size, 'picker');
    await page.keyboard.press('Escape');

    await page.getByTestId('settings-button').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await shot(page, size, 'settings');
    await page.keyboard.press('Escape');

    await debug(page, "dockAt('mars')");
    await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
    const spot = page.locator('[data-testid^="spot-"]').first();
    await spot.focus();
    await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
    await spot.press('Enter');
    await expect(page.getByTestId('fact-card')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, size, 'mars-fact');
  });
}
