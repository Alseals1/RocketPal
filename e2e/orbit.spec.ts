import { test, expect, type Page } from '@playwright/test';

/** The parts of the `?debug=1` test handle used here. */
interface DebugHandle {
  getMode(): string;
  dockAt(id: string): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

function watchForErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function start(page: Page) {
  await page.goto('/?debug=1&quality=high');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
}

const face = (page: Page) => page.locator('.orbit-face');

/** Holds the Mars picture back for a moment so the "loading" look can be seen. */
async function slowMarsPicture(page: Page, ms = 1500) {
  await page.route('**/textures/surfaces/mars-jezero-*.jpg', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

test('Orbit has three pictures, only the one for its mood shows, and they are decoration only', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });

  const images = face(page).locator('img');
  await expect(images).toHaveCount(3);
  for (const img of await images.all()) {
    // Loaded for real (not a broken picture), and the same size the old face was.
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(img).toHaveAttribute('alt', '');
  }
  await expect(page.locator('.orbit-face img:visible')).toHaveCount(1);
  const box = await page.locator('.orbit-face img:visible').boundingBox();
  expect(Math.round(box!.width)).toBe(64);
  expect(Math.round(box!.height)).toBe(64);

  // A screen reader hears Orbit's words from the speech bubble and skips the face.
  await expect(face(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('orbit')).toContainText("I'm Orbit");
  expect(errors).toEqual([]);
});

test('Orbit thinks while the picture loads, is calm after, and is happy after a find', async ({ page }) => {
  const errors = watchForErrors(page);
  await slowMarsPicture(page);
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));

  await expect(page.locator('.surface-loading')).toBeVisible();
  await expect(face(page)).toHaveAttribute('data-mood', 'thinking');
  await expect(page.locator('.orbit-face .mood-thinking')).toBeVisible();

  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(face(page)).toHaveAttribute('data-mood', 'neutral');
  await expect(page.locator('.orbit-face .mood-neutral')).toBeVisible();

  const spot = page.getByTestId('spot-sky');
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(face(page)).toHaveAttribute('data-mood', 'happy');
  await page.getByTestId('close-card').click();
  await expect(face(page)).toHaveAttribute('data-mood', 'happy'); // Orbit says "Nice find!"
  await expect(page.locator('.orbit-face .mood-happy')).toBeVisible();

  expect(errors).toEqual([]);
});

test('landing on the same world again: Orbit thinks, then is calm, not still happy from the last visit', async ({ page }) => {
  await slowMarsPicture(page, 1000);
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  const spot = page.getByTestId('spot-sky');
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(face(page)).toHaveAttribute('data-mood', 'happy');
  await page.getByTestId('close-card').click();

  await page.getByTestId('back-to-space').click();
  await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeVisible();
  await expect(face(page)).toHaveAttribute('data-mood', 'thinking'); // not the happy face left over from before
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5'); // a fresh visit
  await expect(face(page)).toHaveAttribute('data-mood', 'neutral');
});

test('if Orbit\'s pictures cannot load, the screen still works and Orbit still talks', async ({ page }) => {
  // The browser reports each blocked picture as a console error by itself; those are expected here.
  const errors = watchForErrors(page, [/Failed to load resource/]);
  await page.route('**/images/orbit-*.png', (route) => route.abort());
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });

  await expect(page.getByTestId('orbit')).toContainText("I'm Orbit");
  const spot = page.getByTestId('spot-sky');
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await page.getByTestId('close-card').click();
  await expect(page.getByTestId('orbit')).toContainText('Nice find');
  expect(errors).toEqual([]);
});
