import { test, expect, type Page } from '@playwright/test';

interface DebugHandle {
  isReducedMotion(): boolean;
  getSettings(): { textSize: string; reducedMotion: string };
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;
const rootFontSize = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

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

const open = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
};
const choose = (page: Page, name: string) => page.getByRole('radio', { name, exact: true }).click();

test('the settings panel opens and closes with the button, Done, Escape, and a tap outside', async ({ page }) => {
  await start(page);
  await expect(page.getByTestId('settings-panel')).toBeHidden();

  await open(page);
  await page.getByTestId('settings-done').click();
  await expect(page.getByTestId('settings-panel')).toBeHidden();

  await open(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-panel')).toBeHidden();

  await open(page);
  await page.mouse.click(5, 5); // outside the card
  await expect(page.getByTestId('settings-panel')).toBeHidden();
});

test('Space goes back to boosting after the settings panel is closed, however it was closed', async ({ page }) => {
  await start(page);
  const speed = () => page.evaluate(() => (window as unknown as { rocketPals: { getShip(): { speed: number } } }).rocketPals.getShip().speed);

  for (const close of [
    () => page.keyboard.press('Escape'),
    () => page.getByTestId('settings-done').click(),
    () => page.mouse.click(5, 5),
  ]) {
    await open(page);
    await close();
    await expect(page.getByTestId('settings-panel')).toBeHidden();
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    expect(await speed()).toBeGreaterThan(80); // boosting, and the panel did not pop open again
    await expect(page.getByTestId('settings-panel')).toBeHidden();
    await page.keyboard.up('Space');
    await page.waitForTimeout(2500);
  }
});

test('every settings control is a big target and the buttons do not overlap', async ({ page }) => {
  await start(page);
  const gear = (await page.getByTestId('settings-button').boundingBox())!;
  const where = (await page.getByTestId('where-button').boundingBox())!;
  expect(gear.width).toBeGreaterThanOrEqual(56);
  expect(gear.height).toBeGreaterThanOrEqual(56);
  expect(gear.y).toBeGreaterThanOrEqual(where.y + where.height); // sits under "Where to?"

  await open(page);
  const controls = [...(await page.getByRole('radio').all()), page.getByTestId('settings-done')];
  expect(controls.length).toBe(7); // 3 text sizes + 3 motion choices + Done
  for (const control of controls) {
    const box = (await control.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);
  }
});

test('text size changes the real text size and is remembered after a reload', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);
  expect(await rootFontSize(page)).toBe(18);

  await open(page);
  await choose(page, 'Big');
  expect(await rootFontSize(page)).toBe(22.5);
  await choose(page, 'Extra big');
  expect(await rootFontSize(page)).toBe(27);
  await expect(page.getByRole('radio', { name: 'Extra big' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Normal' })).toHaveAttribute('aria-checked', 'false');

  await page.reload();
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  expect(await rootFontSize(page)).toBe(27); // already big before the game finishes drawing
  expect(await debug(page, (h) => h.getSettings().textSize)).toBe('huge');
  await open(page);
  await expect(page.getByRole('radio', { name: 'Extra big' })).toHaveAttribute('aria-checked', 'true');

  await choose(page, 'Normal');
  expect(await rootFontSize(page)).toBe(18);
  expect(errors).toEqual([]);
});

test('reduce motion: on, off, and "same as my computer"', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);

  // Default: follows the computer, which asks for less motion.
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

  // The player says "off", even though the computer asks for less.
  await open(page);
  await choose(page, 'Off');
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');

  // And it is remembered.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(false);

  // "On" wins when the computer does not ask for anything.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page);
  await choose(page, 'On');
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(true);

  // Back to "same as my computer": follows it live, with no reload.
  await choose(page, 'Same as my computer');
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => debug(page, (h) => h.isReducedMotion())).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => debug(page, (h) => h.isReducedMotion())).toBe(false);
});

test('the game still works when the browser will not save anything', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const errors = watchForErrors(page);
  await start(page);
  expect(await rootFontSize(page)).toBe(18);

  await open(page);
  await choose(page, 'Big');
  expect(await rootFontSize(page)).toBe(22.5); // works for now, just cannot be remembered
  await page.getByTestId('settings-done').click();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test.describe('phone-sized screens with the biggest text', () => {
  for (const viewport of [
    { width: 420, height: 900 },
    { width: 844, height: 390 },
  ]) {
    test(`nothing is cut off at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await start(page, '&touch=1');
      await open(page);
      await choose(page, 'Extra big');

      // Checked before any scrolling: nobody should have to scroll to find "Done": the whole panel fits on a phone held sideways too.
      if (viewport.height < 520) {
        const done = (await page.getByTestId('settings-done').boundingBox())!;
        expect(done.y + done.height).toBeLessThanOrEqual(viewport.height);
      }

      // The panel can scroll, but its title must start on the screen and its buttons must all be reachable.
      expect((await page.locator('#settings-title').boundingBox())!.y).toBeGreaterThanOrEqual(0);
      for (const control of [...(await page.getByRole('radio').all()), page.getByTestId('settings-done')]) {
        await control.scrollIntoViewIfNeeded();
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.getByTestId('settings-done').click();

      // The stats card must not run off the left edge or under the buttons on the right.
      const stats = (await page.locator('.stats').boundingBox())!;
      const where = (await page.getByTestId('where-button').boundingBox())!;
      expect(stats.x).toBeGreaterThanOrEqual(0);
      expect(stats.x + stats.width).toBeLessThanOrEqual(where.x);
    });
  }
});

test('everything in the settings panel works with the keyboard alone', async ({ page }) => {
  await start(page);
  const yawBefore = await page.evaluate(() => (window as unknown as { rocketPals: { getShip(): { yaw: number } } }).rocketPals.getShip().yaw);

  await page.getByTestId('settings-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Normal', exact: true })).toBeFocused();

  // Arrow keys move between the choices and pick them, and wrap around at the ends.
  await page.keyboard.down('ArrowRight'); // held for a moment: if the game heard it too, the rocket would turn
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Big', exact: true })).toBeFocused();
  expect(await rootFontSize(page)).toBe(22.5);
  await page.keyboard.press('ArrowDown');
  expect(await rootFontSize(page)).toBe(27);
  await page.keyboard.press('ArrowRight'); // wraps to the first
  expect(await rootFontSize(page)).toBe(18);
  await page.keyboard.press('ArrowLeft'); // wraps to the last
  expect(await rootFontSize(page)).toBe(27);
  await page.keyboard.press('Home');
  expect(await rootFontSize(page)).toBe(18);
  await page.keyboard.press('End');
  expect(await rootFontSize(page)).toBe(27);

  // Tab goes to the next group, and arrows change it too.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Same as my computer', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'On', exact: true })).toBeChecked();
  expect(await debug(page, (h) => h.isReducedMotion())).toBe(true);

  // Tab stays inside the panel: Done, then back to the first choice; Shift+Tab goes back.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('settings-done')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Extra big', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('settings-done')).toBeFocused();

  // The arrow keys picked settings; they did not steer the rocket.
  const yawAfter = await page.evaluate(() => (window as unknown as { rocketPals: { getShip(): { yaw: number } } }).rocketPals.getShip().yaw);
  expect(Math.abs(yawAfter - yawBefore)).toBeLessThan(0.01);

  await page.keyboard.press('Enter'); // Done
  await expect(page.getByTestId('settings-panel')).toBeHidden();
  await page.keyboard.press('Tab'); // the first Tab starts at the top of the page
  await expect(page.getByTestId('where-button')).toBeFocused();
});

test('turning reduced motion on really switches the animations off in the page', async ({ page }) => {
  const duration = () => page.getByTestId('where-button').evaluate((el) => getComputedStyle(el).transitionDuration);
  await start(page);
  expect(await duration()).not.toBe('0s'); // buttons ease when pressed

  await open(page);
  await choose(page, 'On');
  expect(await duration()).toBe('0s');
  await choose(page, 'Off');
  expect(await duration()).not.toBe('0s');
});

test("before the game has started, the computer's reduced-motion setting already applies to the page", async ({ browser }) => {
  // The game script is blocked, so only the page's own stylesheet is at work. A button is added by hand to measure.
  const durationFor = async (reducedMotion: 'reduce' | 'no-preference') => {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-reduced-motion', /.*/); // the game has not touched the page
    const duration = await page.evaluate(() => {
      const button = document.createElement('button');
      button.className = 'big-button';
      document.body.appendChild(button);
      return getComputedStyle(button).transitionDuration;
    });
    await context.close();
    return duration;
  };
  expect(await durationFor('no-preference')).not.toBe('0s');
  expect(await durationFor('reduce')).toBe('0s');
});

test('the first Tab after closing the settings panel with Escape starts at the top of the page', async ({ page }) => {
  await start(page);
  await page.getByTestId('settings-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('where-button')).toBeFocused(); // not the page body
});

test('the first Tab after closing the destination picker with Escape starts at the top of the page', async ({ page }) => {
  await start(page);
  await page.getByTestId('where-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('where-button')).toBeFocused();
});

test('the settings panel tells screen readers it is a modal dialog', async ({ page }) => {
  await start(page);
  await expect(page.getByTestId('settings-panel')).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('settings-panel')).toHaveAttribute('role', 'dialog');
});

test('while the settings panel is open the rocket does not steer or boost behind it', async ({ page }) => {
  await start(page);
  const yaw = () => page.evaluate(() => (window as unknown as { rocketPals: { getShip(): { yaw: number } } }).rocketPals.getShip().yaw);
  const speed = () => page.evaluate(() => (window as unknown as { rocketPals: { getShip(): { speed: number } } }).rocketPals.getShip().speed);
  const before = await yaw();

  await open(page);
  for (const key of ['KeyD', 'KeyA', 'ArrowRight', 'ArrowLeft']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
  }
  await page.getByTestId('settings-done').focus();
  await page.keyboard.down('ArrowRight'); // even with Done focused
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  expect(Math.abs((await yaw()) - before)).toBeLessThan(0.01);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1200);
  expect(await speed()).toBeLessThan(60);
  await page.keyboard.up('Space');

  // Closed again: steering works again.
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  expect((await yaw()) - before).toBeLessThan(-0.2);
});
