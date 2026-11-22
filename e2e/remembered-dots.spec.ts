import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';

// Found dots are remembered between visits and after a reload, on every arrival view (#43). Opening a dot found on an
// earlier visit still counts as a repeat, exactly as before: the recorder adds one to `repeats["dot:<place>/<id>"]`.

interface DebugHandle {
  getMode(): string;
  dockAt(id: string): void;
  getFound(): number;
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

async function waitForGame(page: Page) {
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);
}

async function start(page: Page) {
  await page.goto('/?debug=1&quality=high&touch=1');
  await waitForGame(page);
}

async function land(page: Page, world: string) {
  await page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt(id), world);
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
}

async function backToSpace(page: Page) {
  await page.getByTestId('back-to-space').click();
  await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
}

/** Opens one dot's card with the keyboard and closes it again. */
async function openDot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await page.getByTestId('close-card').click();
  await expect(page.getByTestId('fact-card')).toBeHidden();
}

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('rocketpals.progress') ?? '{}')) as Promise<{
    dots?: string[];
    repeats?: Record<string, number>;
    missions?: Record<string, unknown>;
  }>;

test('found dots stay found after leaving, coming back and reloading; a re-read still counts as a repeat', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');
  await openDot(page, 'rim');
  await openDot(page, 'ground');
  expect((await saved(page)).repeats?.['dot:mars/rim']).toBeUndefined(); // a first find is not a repeat

  await backToSpace(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 2 of 5');
  for (const id of ['rim', 'ground']) {
    await expect(page.getByTestId(`spot-${id}`)).toHaveClass(/is-found/);
    await expect(page.getByTestId(`spot-${id}`)).toHaveAttribute('aria-label', /found\. Tap to read again/);
  }
  await expect(page.getByTestId('spot-sky')).not.toHaveClass(/is-found/);
  expect(await debug(page, (h) => h.getFound())).toBe(2);
  await expect(page.getByTestId('orbit')).toContainText("I'm Orbit"); // dots are left, so Orbit starts as usual

  // Re-reading a dot found on the last visit is a repeat (1 XP up to the cap), not a new find.
  await openDot(page, 'rim');
  await expect(page.getByTestId('found')).toHaveText('Found 2 of 5');
  expect((await saved(page)).repeats?.['dot:mars/rim']).toBe(1);
  await openDot(page, 'rim'); // the same visit: counted once per visit
  expect((await saved(page)).repeats?.['dot:mars/rim']).toBe(1);

  await page.reload();
  await waitForGame(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 2 of 5');
  await expect(page.getByTestId('spot-ground')).toHaveClass(/is-found/);
  await openDot(page, 'rim');
  expect((await saved(page)).repeats?.['dot:mars/rim']).toBe(2);

  const before = await saved(page);
  expect(before.dots?.filter((d) => d.startsWith('mars/')).sort()).toEqual(['mars/ground', 'mars/rim']);
  expect(errors).toEqual([]);
});

test('a world where every dot was found before says so when you come back', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);
  await land(page, 'earth');
  const ids = await page.locator('[data-testid^="spot-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.slice(5)));
  for (const id of ids) await openDot(page, id);
  await expect(page.getByTestId('found')).toHaveText(`Found ${ids.length} of ${ids.length}`);

  await backToSpace(page);
  await land(page, 'earth');
  await expect(page.getByTestId('found')).toHaveText(`Found ${ids.length} of ${ids.length}`);
  await expect(page.getByTestId('orbit')).toHaveText('You found everything here! Tap a dot to read it again.');
  expect(errors).toEqual([]);
});

test('a dot found in another window shows as found here without a reload', async ({ page, context }) => {
  await start(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');

  const other = await context.newPage();
  await start(other);
  await land(other, 'mars');
  await openDot(other, 'sky');

  await expect(page.getByTestId('found')).toHaveText('Found 1 of 5');
  await expect(page.getByTestId('spot-sky')).toHaveClass(/is-found/);
});

test('when the browser will not save anything, dots are remembered for the session only', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const errors = watchForErrors(page);
  await start(page);
  await land(page, 'mars');
  await openDot(page, 'rim');
  await backToSpace(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 1 of 5');
  await expect(page.getByTestId('spot-rim')).toHaveClass(/is-found/);

  await page.reload();
  await waitForGame(page);
  await land(page, 'mars');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');
  expect(errors).toEqual([]);
});
