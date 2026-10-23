import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface SurfaceFile {
  surfaces: { worldId: string; hotspots: { id: string; label: string; title: string; text: string; azimuth: number }[] }[];
}
const surfaces = JSON.parse(readFileSync('public/data/surfaces.json', 'utf8')) as SurfaceFile;
const mars = surfaces.surfaces.find((s) => s.worldId === 'mars')!;

interface DebugHandle {
  getMode(): string;
  getLook(): { azimuth: number; elevation: number } | undefined;
  getFound(): number;
  hasPanorama(): boolean;
  getShip(): { docked: boolean };
  dockAt(id: string): void;
  pickTarget(id: string): void;
  setAutopilot(on: boolean): void;
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

async function start(page: Page, query = '&quality=high') {
  await page.goto(`/?debug=1${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
}

/** Docks at Mars straight away and waits for the picture to finish loading. */
async function landOnMars(page: Page, query?: string) {
  await start(page, query);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
}

/** Looks at the real 3D picture (not the buttons on top) and measures how Mars-coloured it is. */
async function marsColours(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = copy.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let orange = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 16) {
      total++;
      const [r, gr, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 60 && r > gr * 1.1 && gr >= b) orange++; // red-orange-brown, like Martian dirt and sky
    }
    return { orangeShare: orange / total };
  });
}

/** Brings a dot on screen by tabbing to it (the view swings round), and returns it. */
async function reachSpot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  return spot;
}

test('landing at Mars puts you inside the real NASA photo', async ({ page }) => {
  const errors = watchForErrors(page);
  await landOnMars(page);

  await expect(page.locator('.surface-title')).toContainText('Jezero Crater, Mars');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');
  await expect(page.getByTestId('photo-credit')).toContainText('NASA/JPL-Caltech/MSSS/ASU');
  await expect(page.getByTestId('orbit')).toContainText("I'm Orbit");
  await expect(page.getByTestId('back-to-space')).toBeVisible();
  // The space screen's own buttons are gone while you stand on Mars.
  await expect(page.getByTestId('where-button')).toBeHidden();

  // The credit says plainly that the sky above and the ground below are filled in.
  await expect(page.getByTestId('photo-credit')).toContainText('filled in');
  // Each glowing dot has a dark outline, so it can be seen on the bright sky as well as on dark rock.
  const ring = await page.getByTestId('spot-sky').locator('.spot-ring').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toMatch(/rgb\(18, 22, 61\) 0px 0px 0px 3px/); // a navy outline 3 px wide, not just the colour
  // The picture says what it is for people who cannot see it.
  await expect(page.locator('#game-canvas canvas')).toHaveAttribute('aria-label', /Mars/);

  // The picture really is a photo of Mars: a lot of it is red-orange.
  expect((await marsColours(page)).orangeShare).toBeGreaterThan(0.35);
  expect(errors).toEqual([]);
});

test('flying to Mars on autopilot ends with you standing on it', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await page.getByTestId('where-button').click();
  await page.getByRole('button', { name: 'Mars' }).click();
  await page.getByTestId('autopilot-button').click();
  await expect(page.locator('.surface-title')).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
});

test('every glowing dot opens a card with its own NASA-checked words, and Orbit keeps count', async ({ page }) => {
  const errors = watchForErrors(page);
  await landOnMars(page);

  let found = 0;
  for (const spot of mars.hotspots) {
    const button = await reachSpot(page, spot.id);
    await button.press('Enter');
    const card = page.getByTestId('fact-card');
    await expect(card).toBeVisible();
    await expect(card.locator('h2')).toHaveText(spot.title);
    await expect(card.locator('.fact-text')).toHaveText(spot.text);
    // Honest wording: the facts come from NASA's website, and we checked them. NASA did not review anything.
    await expect(card.locator('.fact-source')).toHaveText("Facts from NASA's website. Checked October 23, 2026.");
    await expect(page.getByTestId('listen')).toBeVisible();
    found++;
    await expect(page.getByTestId('found')).toHaveText(`Found ${found} of 5`);

    await page.getByTestId('close-card').click();
    await expect(card).toBeHidden();
    await expect(page.getByTestId('orbit')).toContainText(found < 5 ? `${5 - found} more to discover` : 'You found everything here');
  }
  expect(await debug(page, (h) => h.getFound())).toBe(5);
  expect(errors).toEqual([]);
});

test('you can look around by dragging, by swiping, and with the arrow keys', async ({ page }) => {
  await landOnMars(page);
  const look = () => debug(page, (h) => h.getLook()!);
  const start0 = await look();
  const box = (await page.locator('#game-canvas canvas').boundingBox())!;

  // Drag the picture to the left: the view turns right (more azimuth), by about 70 degrees across the screen height.
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7 - box.height, y, { steps: 6 });
  await page.mouse.up();
  const dragged = await look();
  const turned = (dragged.azimuth - start0.azimuth + 360) % 360;
  expect(turned).toBeGreaterThan(55);
  expect(turned).toBeLessThan(85);

  // Arrow keys: right turns right, up tilts up, and the tilt stops before the picture could flip over.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const keyed = await look();
  expect((keyed.azimuth - dragged.azimuth + 360) % 360).toBeGreaterThan(20);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowUp');
  const tilted = await look();
  expect(tilted.elevation).toBeGreaterThan(40);
  expect(tilted.elevation).toBeLessThan(90);
});

test('Tab reaches each dot, and a dot that is round the back swings into view', async ({ page }) => {
  await landOnMars(page);
  // The rover is nowhere near where you start looking.
  const rover = page.getByTestId('spot-rover');
  await expect(rover).toHaveCSS('opacity', '0');
  await rover.focus();
  await expect(rover).toHaveCSS('opacity', '1', { timeout: 5000 });
  const want = mars.hotspots.find((s) => s.id === 'rover')!;
  // The view keeps swinging for a moment after the dot first appears; wait for it to arrive.
  await expect
    .poll(async () => {
      const look = (await debug(page, (h) => h.getLook()))!;
      return Math.abs(((look.azimuth - want.azimuth + 540) % 360) - 180);
    })
    .toBeLessThan(2);
  // Every dot has a name for screen readers.
  for (const spot of mars.hotspots) {
    await expect(page.getByTestId(`spot-${spot.id}`)).toHaveAttribute('aria-label', `${spot.label}: tap to learn more`);
  }
});

test('the fact card is a proper dialog: Tab stays inside, Escape closes it, and focus goes back to the dot', async ({ page }) => {
  await landOnMars(page);
  const spot = await reachSpot(page, 'ground');
  await spot.press('Enter');
  const card = page.getByTestId('fact-card');
  await expect(card).toHaveAttribute('role', 'dialog');
  await expect(card).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('listen')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByTestId('close-card')).toBeFocused();
  await page.keyboard.press('Tab'); // wraps round inside the card
  await expect(page.getByTestId('listen')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByTestId('close-card')).toBeFocused();

  // The view may still be swinging round to the dot as the card opens: let it settle first.
  await expect
    .poll(async () => {
      const a = (await debug(page, (h) => h.getLook()))!;
      await page.waitForTimeout(200);
      const b = (await debug(page, (h) => h.getLook()))!;
      return Math.abs(a.azimuth - b.azimuth) + Math.abs(a.elevation - b.elevation);
    })
    .toBeLessThan(0.01);

  // While the card is open, the arrow keys do not turn the view behind it.
  const before = await debug(page, (h) => h.getLook());
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  expect(await debug(page, (h) => h.getLook())).toEqual(before);

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(spot).toBeFocused(); // keyboard users carry on from where they were
});

test.describe('read aloud', () => {
  test('Listen reads the title and the words, Stop and closing the card stop it, and it says so when it finishes', async ({ page }) => {
    // A pretend voice, so the test can see what would be read.
    await page.addInitScript(() => {
      const log: string[] = [];
      let current: SpeechSynthesisUtterance | null = null;
      (window as unknown as { __spoken: string[]; __cancels: number }).__spoken = log;
      (window as unknown as { __cancels: number }).__cancels = 0;
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [],
          speak(u: SpeechSynthesisUtterance) {
            current = u;
            log.push(u.text);
          },
          cancel() {
            (window as unknown as { __cancels: number }).__cancels++;
            current = null;
          },
          finish() {
            current?.onend?.(new Event('end') as SpeechSynthesisEvent);
          },
        },
        configurable: true,
      });
    });
    await landOnMars(page);
    const spot = await reachSpot(page, 'rim');
    await spot.press('Enter');

    const listen = page.getByTestId('listen');
    await expect(listen).toHaveText('Listen');
    await listen.click();
    await expect(listen).toHaveText('Stop');
    const rim = mars.hotspots.find((s) => s.id === 'rim')!;
    expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([`${rim.title}. ${rim.text}`]);

    // Finishing by itself puts the button back.
    await page.evaluate(() => (window.speechSynthesis as unknown as { finish(): void }).finish());
    await expect(listen).toHaveText('Listen');

    // Stop, then listen again, then close the card while it is still talking.
    await listen.click();
    await expect(listen).toHaveText('Stop');
    await listen.click();
    await expect(listen).toHaveText('Listen');
    await listen.click();
    const cancelsBefore = await page.evaluate(() => (window as unknown as { __cancels: number }).__cancels);
    await page.getByTestId('close-card').click();
    expect(await page.evaluate(() => (window as unknown as { __cancels: number }).__cancels)).toBeGreaterThan(cancelsBefore);
  });

  test('says so plainly when the computer has no voice', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
    await landOnMars(page);
    await (await reachSpot(page, 'sky')).press('Enter');
    const listen = page.getByTestId('listen');
    await expect(listen).toHaveText('No voice on this computer');
    await expect(listen).toBeDisabled();
    // The words are still on the card to read.
    await expect(page.getByTestId('fact-card')).toContainText('dust');
  });
});

test('Back to space lifts off again, and you can land again with a fresh count', async ({ page }) => {
  await landOnMars(page);
  await (await reachSpot(page, 'rim')).press('Enter');
  await page.getByTestId('close-card').click();
  await expect(page.getByTestId('found')).toHaveText('Found 1 of 5');

  await page.getByTestId('back-to-space').click();
  await expect(page.locator('.surface-title')).toBeHidden();
  expect(await debug(page, (h) => h.getMode())).toBe('space');
  expect((await debug(page, (h) => h.getShip())).docked).toBe(false);
  await expect(page.getByTestId('where-button')).toBeVisible();
  await expect(page.getByTestId('landed')).toBeHidden();

  // Pick Mars again from where we are: Mars is now "you're here", so go somewhere else and come back by dock.
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');
});

test('other worlds without a photo yet still get the plain landing card', async ({ page }) => {
  await start(page);
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.getByTestId('landed')).toBeVisible();
  await expect(page.locator('#landed-title')).toHaveText('You landed on Earth!');
  expect(await debug(page, (h) => h.getMode())).toBe('space');
});

test('low quality uses the small picture and high quality the sharp one', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/textures/surfaces/')) requested.push(r.url().split('/').pop()!);
  });
  await landOnMars(page, '&quality=low');
  expect(requested).toEqual(['mars-jezero-2048.jpg']);

  requested.length = 0;
  await landOnMars(page, '&quality=high');
  expect(requested).toEqual(['mars-jezero-4096.jpg']);
});

test('the surface pictures are not downloaded until you land', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/textures/surfaces/')) requested.push(r.url());
  });
  await start(page);
  await page.waitForTimeout(1500);
  expect(requested).toEqual([]); // nothing yet: the first play stays small
});

test('if the picture cannot be loaded, you still get the plain landing card', async ({ page }) => {
  await page.route('**/textures/surfaces/*.jpg', (route) => route.abort());
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.getByTestId('landed')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#landed-title')).toHaveText('You landed on Mars!');
  expect(await debug(page, (h) => h.getMode())).toBe('space');
  await expect(page.locator('.surface-title')).toBeHidden();
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('the stick and boost button give way to dragging, and every button stays big', async ({ page }) => {
    await landOnMars(page, '&quality=high&touch=1');
    await expect(page.getByTestId('stick')).toBeHidden();
    await expect(page.getByTestId('boost-button')).toBeHidden();

    for (const id of ['back-to-space', 'settings-button']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.height, id).toBeGreaterThanOrEqual(56);
      expect(box.width, id).toBeGreaterThanOrEqual(56);
    }
    // Tap a dot that is on screen: it is at least 56 px wide and tall.
    const spot = page.getByTestId('spot-rim');
    await spot.focus();
    await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
    const dot = (await spot.boundingBox())!;
    expect(dot.width).toBeGreaterThanOrEqual(56);
    expect(dot.height).toBeGreaterThanOrEqual(56);

    // Coming back to space brings the stick back.
    await page.getByTestId('back-to-space').click();
    await expect(page.getByTestId('stick')).toBeVisible();
  });

  test('nothing sits on top of anything else, even with the biggest text', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
    );
    for (const size of [
      { width: 420, height: 900 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await landOnMars(page, '&quality=high&touch=1');
      const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const title = await box('.surface-title');
      const back = await box('[data-testid="back-to-space"]');
      const orbit = await box('.orbit');
      const gear = await box('[data-testid="settings-button"]');
      expect(overlaps(title, back), `title over Back at ${size.width}`).toBe(false);
      expect(overlaps(back, gear), `Back over the settings button at ${size.width}`).toBe(false);
      expect(overlaps(title, gear), `title over the settings button at ${size.width}`).toBe(false);
      // The credit stays inside its card.
      const credit = await box('[data-testid="photo-credit"]');
      expect(credit.x + credit.width).toBeLessThanOrEqual(title.x + title.width + 1);
      expect(overlaps(title, orbit), `title over Orbit at ${size.width}`).toBe(false);
      expect(title.x).toBeGreaterThanOrEqual(0);
      expect(orbit.x + orbit.width).toBeLessThanOrEqual(size.width);
      // An open card fits on the screen, or can scroll, and its buttons can be reached.
      const spot = page.getByTestId('spot-rim');
      await spot.focus();
      await spot.press('Enter');
      const done = page.getByTestId('close-card');
      await done.scrollIntoViewIfNeeded();
      const d = (await done.boundingBox())!;
      expect(d.x + d.width).toBeLessThanOrEqual(size.width);
      await done.click();
    }
  });
});

test('the settings panel still works while you stand on Mars, and the view does not turn behind it', async ({ page }) => {
  await landOnMars(page);
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  const before = await debug(page, (h) => h.getLook());
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect(await debug(page, (h) => h.getLook())).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-panel')).toBeHidden();
});

test('the dots only move with transform and opacity: nothing else is rewritten each frame', async ({ page }) => {
  await landOnMars(page);
  const changes = await page.evaluate(
    () =>
      new Promise<{ attributes: number; frames: number }>((resolve) => {
        const counts = { attributes: 0, frames: 0 };
        const observer = new MutationObserver((records) => {
          for (const r of records) {
            if (r.type === 'attributes' && r.attributeName !== 'style') counts.attributes++;
            if (r.type === 'characterData' || r.type === 'childList') counts.attributes++;
          }
        });
        observer.observe(document.querySelector('.surface-hud')!, { subtree: true, attributes: true, childList: true, characterData: true });
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
  expect(changes.attributes).toBeLessThan(5); // standing still, nothing but styles should change
});


test.describe('leaving while the picture is still loading', () => {
  test('and then it fails: no "You landed" card pops up while the rocket is flying', async ({ page }) => {
    await page.route('**/textures/surfaces/*.jpg', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.abort();
    });
    await start(page);
    await debug(page, (h) => h.dockAt('mars'));
    await expect(page.locator('.surface-loading')).toBeVisible();
    await page.getByTestId('back-to-space').click(); // the Back button is above the loading screen
    await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
    await page.waitForTimeout(2500); // the failed load comes back now
    await expect(page.getByTestId('landed')).toBeHidden();
    expect(await debug(page, (h) => h.getMode())).toBe('space');
    expect((await debug(page, (h) => h.getShip())).docked).toBe(false);
  });

  test('and then it succeeds: the picture is thrown away, not kept in memory', async ({ page }) => {
    await page.route('**/textures/surfaces/*.jpg', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await start(page);
    await debug(page, (h) => h.dockAt('mars'));
    await expect(page.locator('.surface-loading')).toBeVisible();
    await page.getByTestId('back-to-space').click();
    await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
    await page.waitForTimeout(2500);
    expect(await debug(page, (h) => h.hasPanorama())).toBe(false);
    await expect(page.getByTestId('landed')).toBeHidden();
    expect(await debug(page, (h) => h.getMode())).toBe('space');
  });
});

test('a second finger on the screen does not make the picture strobe or end the first finger\'s drag', async ({ page }) => {
  await landOnMars(page);
  const look = () => debug(page, (h) => h.getLook()!);
  const turnedBy = (a: { azimuth: number }, b: { azimuth: number }) => Math.abs(((b.azimuth - a.azimuth + 540) % 360) - 180);
  const fire = (type: string, id: number, x: number, y: number) =>
    page.evaluate(
      ([t, i, px, py]) =>
        document
          .querySelector('#game-canvas canvas')!
          .dispatchEvent(new PointerEvent(t as string, { pointerId: i as number, clientX: px as number, clientY: py as number, bubbles: true, isPrimary: i === 1, pointerType: 'touch' })),
      [type, id, x, y],
    );

  const before = await look();
  await fire('pointerdown', 1, 400, 300); // first finger
  await fire('pointerdown', 2, 700, 500); // second finger, far away
  for (let i = 0; i < 6; i++) {
    await fire('pointermove', 1, 400 + (i % 2) * 2, 300); // both fingers wobble by a couple of pixels
    await fire('pointermove', 2, 700, 500 + (i % 2) * 2);
  }
  expect(turnedBy(before, await look())).toBeLessThan(2); // no swing

  await fire('pointerup', 2, 700, 500); // the second finger lifts
  const mid = await look();
  await fire('pointermove', 1, 300, 300); // the first finger is still dragging
  expect(turnedBy(mid, await look())).toBeGreaterThan(5);
  await fire('pointerup', 1, 300, 300);
  const done = await look();
  await fire('pointermove', 1, 100, 300); // nothing is held any more
  expect(turnedBy(done, await look())).toBeLessThan(0.5);
});

test('the game still starts, and flying still works, if the surface data cannot be loaded', async ({ page }) => {
  await page.route('**/data/surfaces.json', (route) => route.abort());
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  // No photo data, so Mars gets the plain landing card for now.
  await expect(page.getByTestId('landed')).toBeVisible();
  await expect(page.locator('#landed-title')).toHaveText('You landed on Mars!');
});

test('the dots say whether you have found them, and the picture describes itself', async ({ page }) => {
  await landOnMars(page);
  const rim = page.getByTestId('spot-rim');
  await expect(rim).toHaveAttribute('aria-label', 'Far away hills: tap to learn more');
  await (await reachSpot(page, 'rim')).press('Enter');
  await page.getByTestId('close-card').click();
  await expect(rim).toHaveAttribute('aria-label', 'Far away hills: found. Tap to read again');

  await expect(page.locator('#game-canvas canvas')).toHaveAttribute('aria-label', /Mars/);
  await page.getByTestId('back-to-space').click();
  await expect(page.locator('#game-canvas canvas')).toHaveAttribute('aria-label', /solar system/);
});

test.describe('read aloud, the tricky bits', () => {
  const fakeVoice = (voices: string) => `
    const utterances = [];
    window.__utterances = utterances;
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => ${voices}, speak(u) { utterances.push(u); }, cancel() {} },
      configurable: true,
    });`;

  test('a late "cancelled" message from an old reading does not stop the new one', async ({ page }) => {
    await page.addInitScript(fakeVoice("[{ lang: 'en-US', localService: true, name: 'Pretend' }]"));
    await landOnMars(page);
    await (await reachSpot(page, 'rim')).press('Enter');
    const listen = page.getByTestId('listen');

    await listen.click(); // reading number 1 starts
    await expect(listen).toHaveText('Stop');
    await listen.click(); // stop it
    await expect(listen).toHaveText('Listen');
    await listen.click(); // reading number 2 starts
    await expect(listen).toHaveText('Stop');

    // Number 1's "I was cancelled" message arrives late, as it can in a real browser.
    await page.evaluate(() => {
      const first = (window as unknown as { __utterances: SpeechSynthesisUtterance[] }).__utterances[0];
      first.onerror?.(new Event('error') as SpeechSynthesisErrorEvent);
      first.onend?.(new Event('end') as SpeechSynthesisEvent);
    });
    await expect(listen).toHaveText('Stop'); // number 2 is still going
  });

  test('says so when the computer has the speech tool but no voices at all', async ({ page }) => {
    await page.addInitScript(fakeVoice('[]'));
    await start(page);
    await page.waitForTimeout(3300); // voices can arrive a moment after the page opens; give them time
    await debug(page, (h) => h.dockAt('mars'));
    await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
    await (await reachSpot(page, 'sky')).press('Enter');
    await expect(page.getByTestId('listen')).toHaveText('No voice on this computer');
    await expect(page.getByTestId('listen')).toBeDisabled();
  });
});

test('leaving and landing again quickly: an old picture finishing late does not wreck the new visit', async ({ page }) => {
  let calls = 0;
  await page.route('**/textures/surfaces/*.jpg', async (route) => {
    const mine = ++calls;
    await new Promise((r) => setTimeout(r, mine === 1 ? 2500 : 200)); // the first load is slow, the second is quick
    await route.continue();
  });
  await start(page);
  await debug(page, (h) => h.dockAt('mars')); // load 1 (slow)
  await expect(page.locator('.surface-loading')).toBeVisible();
  await page.getByTestId('back-to-space').click();
  await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
  await debug(page, (h) => h.dockAt('mars')); // load 2 (quick)
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(3000); // load 1 finishes now
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
  expect(await debug(page, (h) => h.hasPanorama())).toBe(true); // the new visit still has its picture
  expect((await marsColours(page)).orangeShare).toBeGreaterThan(0.35); // and it is drawn
});

test('if the browser will not start reading, the Listen button does not get stuck on Stop', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'en-US', localService: true, name: 'Pretend' }],
        speak() {
          throw new Error('speech service not available');
        },
        cancel() {},
      },
      configurable: true,
    });
  });
  await landOnMars(page);
  await (await reachSpot(page, 'rim')).press('Enter');
  const listen = page.getByTestId('listen');
  await listen.click();
  await expect(listen).toHaveText('Listen'); // back to normal, so it can be tried again
});
