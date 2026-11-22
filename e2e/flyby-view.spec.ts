import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';
import { readFileSync } from 'node:fs';

// The fly-by view (#43, VISUAL_DESIGN 7.5), tested on its own before any world uses it: the surfaces data is routed so
// Earth's photo is shown as a fly-by (cockpit frame, "Flying past Earth"). Earth's photo is already in the asset manifest.

interface Arrival {
  place: string;
  kind: string;
  frame?: string;
  wording: string;
  title: string;
  credit: string;
  creditNote: string;
  sourceUrl: string;
  hotspots: { id: string }[];
}
const file = JSON.parse(readFileSync('public/data/surfaces.json', 'utf8')) as { lastChecked: string; surfaces: Arrival[] };
const earth = file.surfaces.find((s) => s.place === 'earth')!;
const FLYBY_FILE = JSON.stringify({
  ...file,
  surfaces: file.surfaces.map((s) => (s.place === 'earth' ? { ...s, kind: 'flyby', frame: 'cockpit', wording: 'flyingPast', title: 'Flying past Earth' } : s)),
});

interface DebugHandle {
  getMode(): string;
  dockAt(id: string): void;
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

async function routeFlyby(page: Page) {
  await page.route('**/data/surfaces.json', (route) => route.fulfill({ contentType: 'application/json', body: FLYBY_FILE }));
}

async function start(page: Page, query = '&quality=high') {
  await routeFlyby(page);
  await page.goto(`/?debug=1${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);
}

async function flyPastEarth(page: Page, query?: string) {
  await start(page, query);
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
}

async function reachSpot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  return spot;
}

/** Every word on the screen that a kid can see. */
const visibleText = (page: Page) => page.evaluate(() => document.body.innerText);

test('a fly-by shows the photo through a cockpit window, says "flying past", and never "landed"', async ({ page }) => {
  const errors = watchForErrors(page);
  await flyPastEarth(page);
  const hud = page.locator('.surface-hud');
  await expect(hud).toHaveClass(/is-flyby/);
  await expect(page.locator('.surface-title')).toContainText('Flying past Earth');
  await expect(page.getByTestId('found')).toHaveText(`Found 0 of ${earth.hotspots.length}`);
  await expect(page.locator('.found-pips')).toHaveAttribute('aria-valuenow', '0');

  // The cockpit: a rounded window, two struts and a reflection, all drawn only.
  const frame = page.locator('.window-frame.is-cockpit');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('aria-hidden', 'true');
  await expect(frame).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.cockpit-strut')).toHaveCount(2);
  await expect(page.locator('.cockpit-reflection')).toHaveCount(1);

  // One line of credit, with the rest one tap away.
  await expect(page.getByTestId('photo-credit')).toHaveText(`Photo: ${earth.credit}`);
  await expect(page.getByTestId('photo-credit')).toHaveCSS('white-space', 'nowrap');

  expect(await visibleText(page)).not.toMatch(/land(ed|ing)/i);
  expect(errors).toEqual([]);
});

test('the cockpit frame never blocks a tap on a dot near the edge, and the pips fill', async ({ page }) => {
  await flyPastEarth(page);
  const spot = await reachSpot(page, 'array');
  const box = (await spot.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await expect(page.getByTestId('found')).toHaveText(`Found 1 of ${earth.hotspots.length}`);
  await expect(page.locator('.found-pips')).toHaveAttribute('aria-valuenow', '1');
});

test('while the photo loads it says "Flying to Earth...", not "Landing"', async ({ page }) => {
  await page.route('**/textures/surfaces/*.jpg', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await start(page);
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.locator('.surface-loading')).toHaveText('Flying to Earth...');
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
});

test('the credit dialog opens by keyboard, shows the full credit as plain text, and Escape closes it', async ({ page }) => {
  const errors = watchForErrors(page);
  await flyPastEarth(page);
  const info = page.getByTestId('photo-credit-info');
  await expect(info).toHaveAccessibleName('About this photo');
  await info.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByTestId('photo-credit-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(earth.credit);
  await expect(dialog).toContainText(earth.creditNote);
  await expect(dialog).toContainText(earth.sourceUrl);
  await expect(dialog.locator('a')).toHaveCount(0); // no way out of the game
  // Arrow keys wait while the dialog is open: the view does not turn under it.
  const before = await page.evaluate(() => (window as unknown as { rocketPals: { getLook(): unknown } }).rocketPals.getLook());
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(() => (window as unknown as { rocketPals: { getLook(): unknown } }).rocketPals.getLook())).toEqual(before);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(info).toBeFocused();
  expect(await debug(page, (h) => h.getMode())).toBe('surface'); // Escape closed the dialog only
  expect(errors).toEqual([]);
});

test.describe('by touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('the credit dialog opens and closes with taps', async ({ page }) => {
    await flyPastEarth(page, '&quality=high&touch=1');
    await page.getByTestId('photo-credit-info').tap();
    const dialog = page.getByTestId('photo-credit-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Got it' }).tap();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('at every screen size, with the biggest text', () => {
  const SIZES = [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 768, height: 1024 },
  ];
  for (const textSize of ['normal', 'huge']) {
    for (const size of SIZES) {
      test(`nothing sits on top of anything else at ${size.width}x${size.height}, ${textSize} text`, async ({ page }) => {
        if (textSize === 'huge') {
          await page.addInitScript(() =>
            localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
          );
        }
        await page.setViewportSize(size);
        await flyPastEarth(page, '&quality=high&touch=1');
        const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
        const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        const parts = {
          card: await box('.surface-title'),
          back: await box('[data-testid="back-to-space"]'),
          orbit: await box('.orbit'),
          credit: await box('.flyby-credit'),
          gear: await box('[data-testid="settings-button"]'),
        };
        const names = Object.keys(parts) as (keyof typeof parts)[];
        for (const a of names) {
          for (const b of names) {
            if (a < b) expect(overlaps(parts[a], parts[b]), `${a} over ${b}`).toBe(false);
          }
          const p = parts[a];
          expect(p.x, `${a} off the left`).toBeGreaterThanOrEqual(0);
          expect(p.y, `${a} off the top`).toBeGreaterThanOrEqual(0);
          expect(p.x + p.width, `${a} off the right`).toBeLessThanOrEqual(size.width + 1);
          expect(p.y + p.height, `${a} off the bottom`).toBeLessThanOrEqual(size.height + 1);
        }
        for (const target of ['photo-credit-info', 'back-to-space']) {
          const b = (await page.getByTestId(target).boundingBox())!;
          expect(b.width, target).toBeGreaterThanOrEqual(44);
          expect(b.height, target).toBeGreaterThanOrEqual(44);
        }
        // The credit stays one line.
        const credit = await box('[data-testid="photo-credit"]');
        expect(credit.height).toBeLessThan(40);
      });
    }
  }
});

test('with reduced motion the reflection is still there and does not move', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await flyPastEarth(page);
  await expect(page.locator('.cockpit-reflection')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.cockpit-reflection')).toHaveCSS('transition-duration', '0s');
});
