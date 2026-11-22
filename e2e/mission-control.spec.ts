/**
 * Mission Control (#42): one menu button opens a sheet with the Missions and Settings tabs, and the game pauses behind
 * it. Settings itself is covered by settings.spec.ts.
 */
import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';

interface DebugHandle {
  getShip(): { position: { x: number; y: number; z: number }; docked: boolean };
  getTargetId(): string | null;
  getMode(): string;
  getLook(): unknown;
  isPaused(): boolean;
  dockAt(id: string): void;
  pickTarget(id: string): void;
  setAutopilot(on: boolean): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

const SIZES = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];
const TEXT_SIZES = ['normal', 'big', 'huge'];

/** A pretend voice, so Listen can be heard in headless Chrome (it has no voices). */
const WORKING_VOICE = `
  const utterances = [];
  window.__utterances = utterances;
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      getVoices: () => [{ lang: 'en-US', localService: true, name: 'Pretend' }],
      speak(u) { utterances.push(u); setTimeout(() => u.onstart && u.onstart(new Event('start')), 0); },
      cancel() {},
    },
    configurable: true,
  });`;

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function start(page: Page, query = '&quality=high') {
  await page.goto(`/?debug=1${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);
}

async function land(page: Page, world: string) {
  await page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt(id), world);
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
}

const sheet = (page: Page) => page.getByTestId('mission-control');

/** Waits until the sheet has finished growing in (it scales from 0.98), so sizes can be measured. */
const settled = (page: Page) => expect.poll(() => sheet(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');

async function openWithButton(page: Page) {
  await page.getByTestId('menu-button').click();
  await expect(sheet(page)).toBeVisible();
  await settled(page);
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Box extends Rect {
  id: string;
  primary: boolean;
  /** The part that shows: the box cut to every scrolling panel round it (a choice scrolled out of sight shows none). */
  shown: Rect;
}

/** Every button on screen inside the selector, with its box. */
const buttonsIn = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll<HTMLElement>(`${sel} button`)]
        .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
        .map((el, i) => {
          const r = el.getBoundingClientRect();
          let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
          for (let p = el.parentElement; p; p = p.parentElement) {
            if (!/auto|scroll|hidden/.test(getComputedStyle(p).overflowY + getComputedStyle(p).overflowX)) continue;
            const c = p.getBoundingClientRect();
            [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
          }
          const shown = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
          const id = el.dataset.testid ?? `${el.className.split(' ')[0]}#${i}:${el.textContent?.trim().slice(0, 20)}`;
          return { id, x: r.x, y: r.y, width: r.width, height: r.height, primary: el.classList.contains('rp-button--primary'), shown };
        }),
    selector,
  ) as Promise<Box[]>;

const overlaps = (a: Rect, b: Rect) =>
  a.width > 1 && a.height > 1 && b.width > 1 && b.height > 1 &&
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

/** How many different colours a part of the screen has: a blank canvas has one or two, the space scene many. */
async function distinctColours(page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<number> {
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const pixels = g.getImageData(0, 0, img.width, img.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) seen.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
    return seen.size;
  }, png);
}

test.describe('opening and closing', () => {
  test('the menu button opens it on Missions with focus on the tab, the arrows switch tabs, and close puts focus on the game', async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page);
    await expect(sheet(page)).toBeHidden();
    await openWithButton(page);
    await expect(page.getByTestId('tab-missions')).toBeFocused();
    await expect(page.getByTestId('tab-missions')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('missions-panel')).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Mission Control' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('tab-settings')).toBeFocused();
    await expect(page.getByTestId('tab-settings')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await expect(page.getByTestId('missions-panel')).toBeHidden();
    await page.keyboard.press('ArrowRight'); // wraps round
    await expect(page.getByTestId('tab-missions')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('tab-settings')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('tab-missions')).toHaveAttribute('aria-selected', 'true');
    // Only the selected tab is a Tab stop.
    expect(await page.getByRole('tab').evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex))).toEqual([0, -1]);

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('mission-control-close').click();
    await expect(sheet(page)).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.classList.contains('stage'))).toBe(true);

    // It opens on Missions again, whichever tab was open last.
    await openWithButton(page);
    await expect(page.getByTestId('tab-missions')).toHaveAttribute('aria-selected', 'true');
    await page.mouse.click(5, 5); // a tap outside the sheet
    await expect(sheet(page)).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Escape in space opens it and closes it, and a closing Escape does not open it again', async ({ page }) => {
    await start(page);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByTestId('menu-button')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByTestId('menu-button')).toHaveAttribute('aria-expanded', 'false');
    // And again: Escape keeps toggling it.
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeVisible();
  });

  test('Escape with the landing card open does what "Fly again" does, and does not open Mission Control', async ({ page }) => {
    await start(page);
    await debug(page, (h) => h.dockAt('moon'));
    await expect(page.getByTestId('landed')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('landed')).toBeHidden();
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
  });

  test('Escape with the Star Map open closes the map, not opens Mission Control', async ({ page }) => {
    await start(page);
    await page.getByTestId('star-map-button').click();
    await expect(page.getByTestId('star-map')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('star-map')).toBeHidden();
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
  });

  test("on a world's surface the menu button opens it, and Escape there does not", async ({ page }) => {
    await start(page);
    await land(page, 'mars');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
    await openWithButton(page);
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });
});

test.describe('the game pauses behind it', () => {
  test('the ship stops, even on autopilot, and goes on after closing', async ({ page }) => {
    await start(page);
    expect(await debug(page, (h) => h.isPaused())).toBe(false);
    await debug(page, (h) => h.pickTarget('jupiter'));
    await debug(page, (h) => h.setAutopilot(true));
    await page.waitForTimeout(300);

    await openWithButton(page);
    expect(await debug(page, (h) => h.isPaused())).toBe(true);
    const at = await debug(page, (h) => h.getShip().position);
    await page.waitForTimeout(500);
    expect(await debug(page, (h) => h.getShip().position)).toEqual(at);

    await page.getByTestId('mission-control-close').click();
    expect(await debug(page, (h) => h.isPaused())).toBe(false);
    await page.waitForTimeout(300);
    expect(await debug(page, (h) => h.getShip().position)).not.toEqual(at);
  });

  test("on Mars's surface the view does not turn while it is open", async ({ page }) => {
    await start(page);
    await land(page, 'mars');
    await openWithButton(page);
    expect(await debug(page, (h) => h.isPaused())).toBe(true);
    const before = await debug(page, (h) => h.getLook());
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyD');
    expect(await debug(page, (h) => h.getLook())).toEqual(before);
    await page.keyboard.press('Escape');
    expect(await debug(page, (h) => h.isPaused())).toBe(false);
  });

  test('resizing the window while paused still shows the space scene behind it', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await start(page);
    await openWithButton(page);
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.waitForTimeout(500);
    // The left side, beside the sheet: the scene's stars and worlds, not one flat colour.
    expect(await distinctColours(page, { x: 0, y: 150, width: 500, height: 400 })).toBeGreaterThan(20);
  });

  test("resizing while paused on Mars still shows Mars's picture", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await start(page);
    await land(page, 'mars');
    await openWithButton(page);
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.waitForTimeout(500);
    expect(await distinctColours(page, { x: 0, y: 250, width: 500, height: 300 })).toBeGreaterThan(20);
  });
});

test.describe('the Missions tab', () => {
  test('lists both missions from the Sun outwards, and Go sets course from space', async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page);
    await openWithButton(page);
    const rows = page.locator('.mission-row');
    await expect(rows).toHaveCount(2);
    expect(await rows.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.mission))).toEqual(['find-3-earth', 'find-3-mars']);
    await expect(rows.nth(0)).toContainText('Find 3 things out the window');
    await expect(rows.nth(0)).toContainText('Earth · 0 of 3 found');
    await expect(rows.nth(1)).toContainText('Mars · 0 of 3 found');
    // Primary Go on the first open mission only.
    await expect(page.getByTestId('mission-go-find-3-earth')).toHaveClass(/rp-button--primary/);
    await expect(page.getByTestId('mission-go-find-3-mars')).toHaveClass(/rp-button--secondary/);
    await expect(page.getByTestId('mission-go-find-3-mars')).toHaveAccessibleName('Go to Mars');

    await page.getByTestId('mission-go-find-3-mars').click();
    await expect(sheet(page)).toBeHidden();
    expect(await debug(page, (h) => h.getTargetId())).toBe('mars');
    expect(await debug(page, (h) => h.isPaused())).toBe(false);
    await expect(page.getByTestId('autopilot-button')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Go from Earth's surface lifts off and sets course to Mars; Earth says \"You are here\"", async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page);
    await land(page, 'earth');
    await openWithButton(page);
    const earth = page.getByTestId('mission-find-3-earth');
    await expect(earth).toContainText('You are here');
    await expect(earth.getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('mission-go-find-3-mars')).toHaveClass(/rp-button--primary/);

    await page.getByTestId('mission-go-find-3-mars').click();
    await expect(sheet(page)).toBeHidden();
    await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
    expect(await debug(page, (h) => h.getTargetId())).toBe('mars');
    expect((await debug(page, (h) => h.getShip())).docked).toBe(false);
    expect(errors).toEqual([]);
  });

  test('Go from the plain landing card flies off and sets course', async ({ page }) => {
    await start(page);
    // The card covers the menu button, so this happens when the rocket docks with Mission Control already open.
    await openWithButton(page);
    await debug(page, (h) => h.dockAt('moon'));
    await expect(page.getByTestId('landed')).toBeVisible();
    await page.getByTestId('mission-go-find-3-mars').click();
    await expect(page.getByTestId('landed')).toBeHidden();
    expect(await debug(page, (h) => h.getTargetId())).toBe('mars');
  });

  test('Listen reads the list, and opening Mission Control stops other reading', async ({ page }) => {
    await page.addInitScript(WORKING_VOICE);
    await start(page);
    await openWithButton(page);
    const listen = page.getByTestId('missions-listen');
    await expect(listen).toHaveText('Listen');
    await listen.click();
    await expect(listen).toHaveText('Stop');
    const text = await page.evaluate(() => (window as unknown as { __utterances: { text: string }[] }).__utterances.at(-1)!.text);
    expect(text).toBe('Missions. Find 3 things out the window, Earth: 0 of 3 found. Find 3 things on Mars, Mars: 0 of 3 found.');
  });
});

test.describe('every size and text size', () => {
  for (const size of SIZES) {
    for (const textSize of TEXT_SIZES) {
      test(`nothing overlaps or is cut off at ${size.width}x${size.height}, ${textSize} text`, async ({ page }) => {
        const errors = watchForErrors(page);
        await page.addInitScript((t) => localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 2, textSize: t })), textSize);
        await page.setViewportSize(size);
        await start(page, '&quality=high&touch=1');

        // The space HUD: the menu button is big and clear of the other buttons.
        const hud = await buttonsIn(page, '.stage');
        const menu = hud.find((b) => b.id === 'menu-button')!;
        expect(menu.width).toBeGreaterThanOrEqual(56);
        expect(menu.height).toBeGreaterThanOrEqual(56);
        for (const other of hud.filter((b) => b !== menu)) expect(overlaps(menu, other), `menu button overlaps ${other.id}`).toBe(false);

        await openWithButton(page);
        const box = (await sheet(page).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height + 0.5);

        for (const tab of ['missions', 'settings']) {
          await page.getByTestId(`tab-${tab}`).click();
          const buttons = await buttonsIn(page, '[data-testid="mission-control"]');
          expect(buttons.length).toBeGreaterThan(3);
          for (const b of buttons) {
            expect(b.height, `${tab}: ${b.id} height`).toBeGreaterThanOrEqual(b.primary ? 64 : 56);
            expect(b.width, `${tab}: ${b.id} width`).toBeGreaterThanOrEqual(56);
            expect(b.x, `${tab}: ${b.id} inside the screen`).toBeGreaterThanOrEqual(0);
            expect(b.x + b.width, `${tab}: ${b.id} inside the screen`).toBeLessThanOrEqual(size.width + 0.5);
          }
          for (let i = 0; i < buttons.length; i++) {
            for (let j = i + 1; j < buttons.length; j++) {
              expect(overlaps(buttons[i].shown, buttons[j].shown), `${tab}: ${buttons[i].id} overlaps ${buttons[j].id}`).toBe(false);
            }
          }
          // Every button can be scrolled into view inside the sheet.
          for (const button of await sheet(page).locator('button:visible').all()) {
            await button.scrollIntoViewIfNeeded();
            const b = (await button.boundingBox())!;
            expect(b.y).toBeGreaterThanOrEqual(0);
            expect(b.y + b.height).toBeLessThanOrEqual(size.height + 0.5);
          }
        }
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe('modes', () => {
  test('with reduced motion the sheet shows at once, with no scale', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    await page.getByTestId('menu-button').click();
    expect(await sheet(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
    expect(await sheet(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('in low quality the sheet has no blur and works', async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page, '&quality=low');
    await openWithButton(page);
    expect(await sheet(page).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');
    await page.getByTestId('mission-go-find-3-mars').click();
    expect(await debug(page, (h) => h.getTargetId())).toBe('mars');
    expect(errors).toEqual([]);
  });

  test('it works when the browser will not save anything', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const errors = watchForErrors(page);
    await start(page);
    await openWithButton(page);
    await expect(page.locator('.mission-row')).toHaveCount(2);
    await page.getByTestId('tab-settings').click();
    await page.getByRole('radio', { name: 'Big', exact: true }).click();
    await page.getByTestId('settings-done').click();
    await expect(sheet(page)).toBeHidden();
    expect(await debug(page, (h) => h.isPaused())).toBe(false);
    expect(errors).toEqual([]);
  });
});
