import { test, expect, type Page } from '@playwright/test';

/** The test handle that `?debug=1` adds to the page. */
interface DebugHandle {
  getShip(): { yaw: number; pitch: number; speed: number; docked: boolean; position: { x: number; y: number; z: number } };
  getTargetId(): string | null;
  getQuality(): string;
  isGlowVisible(): boolean;
  isReducedMotion(): boolean;
}
const ship = (page: Page) => page.evaluate(() => (window as unknown as { rocketPals: DebugHandle }).rocketPals.getShip());
const handle = <T>(page: Page, fn: (h: DebugHandle) => T) =>
  page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

/** Looks at the real 3D picture (not the buttons on top of it) and counts bright and coloured pixels. */
async function pictureStats(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = copy.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let bright = 0;
    let coloured = 0;
    for (let i = 0; i < data.length; i += 4) {
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      if (max > 180) bright++;
      if (max - min > 60 && max > 80) coloured++;
    }
    return { bright, coloured };
  });
}

/** Reads the number in a HUD line like "78.4 million km to go" as kilometres. */
async function distanceShown(page: Page): Promise<number> {
  const text = (await page.locator('.stats-line').first().innerText()).trim();
  const match = /^([\d,.]+)( million| billion)? km to go$/.exec(text);
  if (!match) throw new Error(`Unexpected distance text: "${text}"`);
  const unit = match[2]?.trim() === 'billion' ? 1e9 : match[2]?.trim() === 'million' ? 1e6 : 1;
  return parseFloat(match[1].replace(/,/g, '')) * unit;
}

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

test('draws the solar system with no console errors', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);

  await expect(page.locator('#game-canvas canvas')).toBeVisible();
  // Pinch-zoom must stay available: it is the only way to enlarge the text until there is a text-size setting.
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /user-scalable|maximum-scale/);
  const box = await page.locator('#game-canvas canvas').boundingBox();
  expect(box!.width).toBeGreaterThan(300);
  // The 3D picture itself (not the HUD on top) has stars in it, and the Sun's orange glow nearby.
  const picture = await pictureStats(page);
  expect(picture.bright).toBeGreaterThan(200);

  // The game loop is running: the rocket flies forward by itself.
  const before = await ship(page);
  await page.waitForTimeout(500);
  const after = await ship(page);
  expect(Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('keyboard steers, pitches, and boosts', async ({ page }) => {
  await start(page);
  const start0 = await ship(page);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  expect((await ship(page)).yaw).toBeLessThan(start0.yaw - 0.3); // turning right lowers the yaw angle

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  expect((await ship(page)).pitch).toBeGreaterThan(start0.pitch + 0.3);
  await page.keyboard.up('KeyW');

  await page.keyboard.down('Space');
  await page.waitForTimeout(2000);
  expect((await ship(page)).speed).toBeGreaterThan(100);
  await page.keyboard.up('Space');
});

test('tap-only: pick Earth, tap Autopilot, and land', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchForErrors(page);
  await start(page);

  await expect(page.locator('[data-testid="autopilot-button"]')).toBeHidden(); // nothing to fly to yet
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Earth' }).click();

  await expect(page.locator('.stats-title')).toHaveText('Flying to Earth');
  const lines = page.locator('.stats-line');
  await expect(lines.nth(0)).toHaveText(/^[\d.,]+ million km to go$/);
  await expect(lines.nth(1)).toHaveText(/^Light needs \d+ (seconds?|minutes?|hours?) to get there$/);
  await expect(lines.nth(2)).toHaveText(/^Pretend speed: [\d.,]+( million| billion)? km per second$/);
  await expect(page.locator('.stats-note')).toHaveText('Real rockets are much slower!');

  // Starting near the Sun and facing Earth: the real Sun-to-Earth gap is 149.6 million km, and the rocket has already set off a little.
  const atStart = await distanceShown(page);
  expect(atStart).toBeGreaterThan(100_000_000);
  expect(atStart).toBeLessThan(160_000_000);

  await page.getByTestId('autopilot-button').click();
  await page.waitForTimeout(2500);
  const later = await distanceShown(page);
  expect(later).toBeLessThan(atStart);
  await page.waitForTimeout(2500);
  expect(await distanceShown(page)).toBeLessThan(later);

  await expect(page.getByTestId('landed')).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('#landed-title')).toHaveText('You landed on Earth!');
  expect((await ship(page)).docked).toBe(true);

  // Fly again: the rocket lifts off and Mars is now "you're here".
  await page.getByTestId('fly-again').click();
  await expect(page.getByTestId('landed')).toBeHidden();
  expect((await ship(page)).docked).toBe(false);
  await page.getByTestId('where-button').click();
  await expect(page.getByRole('button', { name: /Earth/ })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('steering by hand takes over from autopilot', async ({ page }) => {
  await start(page);
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Neptune' }).click();
  await page.getByTestId('autopilot-button').click();
  await expect(page.getByTestId('autopilot-button')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowLeft');
  await expect(page.getByTestId('autopilot-button')).toHaveAttribute('aria-pressed', 'false');
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('shows the stick and boost button, and they fly the rocket', async ({ page }) => {
    await start(page, '&touch=1');
    const stick = page.getByTestId('stick');
    const boost = page.getByTestId('boost-button');
    await expect(stick).toBeVisible();
    await expect(boost).toBeVisible();

    const s = (await stick.boundingBox())!;
    const before = await ship(page);
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width / 2 + 60, s.y + s.height / 2 - 30, { steps: 4 }); // right and up
    await page.waitForTimeout(600);
    const steered = await ship(page);
    await page.mouse.up();
    expect(steered.yaw).toBeLessThan(before.yaw - 0.2);
    expect(steered.pitch).toBeGreaterThan(before.pitch + 0.1);

    const b = (await boost.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    expect((await ship(page)).speed).toBeGreaterThan(100);
    await page.mouse.up();
  });

  test('with the biggest text, nothing sits on top of the touch controls', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
    );
    for (const size of [
      { width: 420, height: 900 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await start(page, '&touch=1');
      await page.evaluate(() => (window as unknown as { rocketPals: { pickTarget(id: string): void } }).rocketPals.pickTarget('mars'));
      const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const autopilot = await box('[data-testid="autopilot-button"]');
      expect(overlaps(autopilot, await box('[data-testid="stick"]')), `autopilot over the stick at ${size.width}`).toBe(false);
      expect(overlaps(autopilot, await box('[data-testid="boost-button"]')), `autopilot over BOOST at ${size.width}`).toBe(false);
      expect(overlaps(await box('.stats'), autopilot), `stats over autopilot at ${size.width}`).toBe(false);
      // The BOOST label fits inside its button.
      const fits = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="boost-button"]') as HTMLElement;
        return b.scrollWidth <= b.clientWidth && b.scrollHeight <= b.clientHeight;
      });
      expect(fits).toBe(true);
    }
  });

  test('every button is a big, easy target (56 px or more)', async ({ page }) => {
    await start(page, '&touch=1');
    await page.getByTestId('where-button').click();
    const buttons = [page.getByTestId('where-button'), page.getByTestId('boost-button'), ...(await page.locator('.world-button').all())];
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect(box.height, await button.innerText()).toBeGreaterThanOrEqual(56);
      expect(box.width).toBeGreaterThanOrEqual(56);
    }
    await page.getByRole('button', { name: 'Earth' }).click();
    expect((await page.getByTestId('autopilot-button').boundingBox())!.height).toBeGreaterThanOrEqual(56);
  });
});

test('low quality mode turns glow off; high quality has it on', async ({ page }) => {
  await start(page);
  expect(await handle(page, (h) => h.getQuality())).toBe('high');
  expect(await handle(page, (h) => h.isGlowVisible())).toBe(true);

  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  expect(await handle(page, (h) => h.getQuality())).toBe('low');
  expect(await handle(page, (h) => h.isGlowVisible())).toBe(false);
});

test('notices when reduced motion is switched on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = watchForErrors(page);
  await start(page);
  expect(await handle(page, (h) => h.isReducedMotion())).toBe(true);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await start(page);
  expect(await handle(page, (h) => h.isReducedMotion())).toBe(false);
});

test('really draws the 3D picture, in both quality levels', async ({ page }) => {
  await start(page);
  expect((await pictureStats(page)).bright).toBeGreaterThan(200);
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.waitForTimeout(300);
  expect((await pictureStats(page)).bright).toBeGreaterThan(50);
});

test('changing your mind mid-flight gives a sensible, shrinking distance', async ({ page }) => {
  await start(page);
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Neptune' }).click();
  await page.getByTestId('autopilot-button').click();
  await page.waitForTimeout(5000);

  // Now pick Earth from the middle of space.
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Earth' }).click();
  const first = await distanceShown(page);
  expect(first).toBeGreaterThan(0);
  await page.getByTestId('autopilot-button').click();
  await page.waitForTimeout(6000); // the rocket first has to turn around
  const second = await distanceShown(page);
  await page.waitForTimeout(2000);
  expect(await distanceShown(page)).toBeLessThan(second);
});

test('Escape closes the picker, and Space goes back to boosting after a click', async ({ page }) => {
  await start(page);
  await page.getByTestId('where-button').click();
  await expect(page.locator('.picker')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.picker')).toBeHidden();
  await page.keyboard.down('Space'); // Escape must not leave the button holding on to the Space bar either
  await page.waitForTimeout(1500);
  expect((await ship(page)).speed).toBeGreaterThan(80);
  await expect(page.locator('.picker')).toBeHidden();
  await page.keyboard.up('Space');
  await page.waitForTimeout(2500);

  // A mouse click must not leave the button holding on to the Space bar.
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Mars' }).click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(1800);
  expect((await ship(page)).speed).toBeGreaterThan(100);
  await expect(page.locator('.picker')).toBeHidden();
  await page.keyboard.up('Space');
});

test('browser shortcuts are not mistaken for steering, and losing focus lets go of the keys', async ({ page }) => {
  await start(page);
  const before = await ship(page);

  await page.keyboard.down('Meta');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('Meta');
  expect(Math.abs((await ship(page)).yaw - before.yaw)).toBeLessThan(0.01);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // the window lost focus; the key-up never arrives
  await page.waitForTimeout(1200); // let the turn die away
  const settled = await ship(page);
  await page.waitForTimeout(500);
  expect(Math.abs((await ship(page)).yaw - settled.yaw)).toBeLessThan(0.01);
  await page.keyboard.up('ArrowLeft');
});

test('boost stays on until the finger that pressed it lets go', async ({ page }) => {
  await start(page, '&touch=1');
  const press = (type: string, pointerId: number) =>
    page.evaluate(
      ([t, id]) =>
        document
          .querySelector('[data-testid="boost-button"]')!
          .dispatchEvent(new PointerEvent(t as string, { pointerId: id as number, bubbles: true, isPrimary: id === 1 })),
      [type, pointerId],
    );

  await press('pointerdown', 1); // first finger down
  await press('pointerdown', 2); // second finger down...
  await press('pointerup', 2); // ...and up again: boost must keep going
  await page.waitForTimeout(2000);
  expect((await ship(page)).speed).toBeGreaterThan(100);

  await press('pointerup', 1);
  await page.waitForTimeout(4000);
  expect((await ship(page)).speed).toBeLessThan(60);
});

test('switches itself to low quality on a slow computer', async ({ browser }) => {
  // Software drawing at double pixel density is slow, like a weak school laptop.
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.waitForFunction(
    () => (window as unknown as { rocketPals: { getQuality(): string } }).rocketPals.getQuality() === 'low',
    null,
    { timeout: 30_000 },
  );
  expect(await handle(page, (h) => h.isGlowVisible())).toBe(false);
  await context.close();
});

test('the HUD does not rewrite the page every frame', async ({ page }) => {
  await start(page);
  // Pick a far-away destination, then count what the HUD changes over about 60 frames.
  const changes = await page.evaluate(
    () =>
      new Promise<{ hidden: number; classes: number; frames: number }>((resolve) => {
        const counts = { hidden: 0, classes: 0, frames: 0 };
        const observer = new MutationObserver((records) => {
          for (const r of records) {
            if (r.attributeName === 'hidden') counts.hidden++;
            if (r.attributeName === 'class') counts.classes++;
          }
        });
        observer.observe(document.querySelector('.hud')!, { subtree: true, attributes: true });
        (window as unknown as { rocketPals: { pickTarget(id: string): void } }).rocketPals.pickTarget('neptune');
        const count = () => {
          counts.frames++;
          if (counts.frames < 60) requestAnimationFrame(count);
          else {
            observer.disconnect();
            resolve(counts);
          }
        };
        requestAnimationFrame(count);
      }),
  );
  // Picking a destination reveals a few things once. It must not be doing this on every frame
  // (the earlier version made about one change per frame for each of these).
  expect(changes.hidden).toBeLessThan(10);
  expect(changes.classes).toBeLessThan(10);
});
