import { test, expect } from '@playwright/test';
import { fontsReady } from './fonts.ts';

// docs/VISUAL_DESIGN.md 4.2: Lexend for text, Fredoka for titles, both from the game's own files.
test('Lexend and Fredoka load from the game\'s own /fonts/ folder and are used', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  const fontRequests: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font' || r.url().endsWith('.woff2')) fontRequests.push(r.url());
  });

  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);

  const loaded = await page.evaluate(() => [document.fonts.check('400 18px Lexend'), document.fonts.check('600 18px Fredoka')]);
  expect(loaded).toEqual([true, true]);

  const origin = new URL(baseURL!).origin;
  expect(fontRequests.length).toBeGreaterThanOrEqual(2);
  for (const url of fontRequests) expect(url.startsWith(`${origin}/fonts/`), url).toBe(true);

  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toMatch(/^"?Lexend"?/);
  const titleFont = await page.locator('.stats-title').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(titleFont).toMatch(/^"?Fredoka"?/);

  expect(errors).toEqual([]);
});
