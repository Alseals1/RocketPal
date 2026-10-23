import { readFileSync } from 'node:fs';
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

/** Holds the landing pictures back for a moment so the "loading" look can be seen. */
async function slowPictures(page: Page, ms = 1500) {
  await page.route('**/textures/surfaces/*.jpg', async (route) => {
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
  // Each mood has its own picture file.
  for (const mood of ['neutral', 'happy', 'thinking']) {
    await expect(face(page).locator(`.mood-${mood}`)).toHaveAttribute('src', `/images/orbit-${mood}.png`);
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
  await slowPictures(page);
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));

  await expect(page.locator('.surface-loading')).toBeVisible();
  await expect(face(page)).toHaveAttribute('data-mood', 'thinking');
  await expect(page.locator('.orbit-face .mood-thinking')).toBeVisible();
  // "Visible" is not enough: the loading screen must not be drawn over Orbit. Ask the browser what is at Orbit's spot.
  const topmostIsOrbit = await page.locator('.orbit-face .mood-thinking').evaluate((img) => {
    // Orbit ignores the mouse, and the browser skips such things when asked what is on top, so let it listen just for this question.
    (img.closest('.orbit') as HTMLElement).style.pointerEvents = 'auto';
    const r = img.getBoundingClientRect();
    return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.orbit-face');
  });
  expect(topmostIsOrbit).toBe(true);

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
  await slowPictures(page, 1000);
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

test('while the picture loads, the dots cannot be reached and the bubble waits; both come back after', async ({ page }) => {
  await slowPictures(page, 1500);
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeVisible();

  // A dot cannot be tabbed to (it would open a card behind the black screen), and Orbit's bubble is not drawn over the loading words.
  const focusedSpot = () =>
    page.getByTestId('spot-sky').evaluate((el) => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });
  expect(await focusedSpot()).toBe(false);
  await expect(page.getByTestId('orbit')).toHaveCSS('visibility', 'hidden');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 5');

  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId('orbit')).toHaveCSS('visibility', 'visible');
  expect(await focusedSpot()).toBe(true);
});

test('on the smallest screen with the biggest text, nothing covers the loading words while loading', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await slowPictures(page, 2500);
  await start(page);
  for (const world of ['mars', 'earth']) {
    await page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt(id), world);
    await expect(page.locator('.surface-loading')).toBeVisible();
    const boxes = await page.evaluate(() => {
      const rect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height });
      const words = document.createRange();
      words.selectNodeContents(document.querySelector('.surface-loading')!);
      return {
        words: rect(words.getBoundingClientRect()),
        face: rect(document.querySelector('.orbit-face')!.getBoundingClientRect()),
        bubbleHidden: getComputedStyle(document.querySelector('.orbit-bubble')!).visibility === 'hidden',
      };
    });
    const overlaps = (a: typeof boxes.words, b: typeof boxes.words) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(boxes.bubbleHidden, `${world}: bubble waits`).toBe(true);
    expect(overlaps(boxes.words, boxes.face), `${world}: Orbit's face over the loading words`).toBe(false);
    await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
    await page.getByTestId('back-to-space').click();
    await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
  }
});

test('a dot is drawn above Orbit, and the fact card is above both', async ({ page }) => {
  await start(page);
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });

  // Orbit ignores the mouse, and the browser skips such things when asked what is on top, so let it listen just for this question.
  await page.locator('.orbit').evaluate((el) => ((el as HTMLElement).style.pointerEvents = 'auto'));

  // Park a dot that is off screen (the game leaves its place alone) on top of Orbit's face and ask what is drawn on top there.
  const order = await page.evaluate(() => {
    const face = document.querySelector('.orbit-face')!.getBoundingClientRect();
    const spot = [...document.querySelectorAll<HTMLElement>('.spot')].find((el) => getComputedStyle(el).opacity === '0')!;
    spot.style.opacity = '1';
    spot.style.pointerEvents = 'auto';
    spot.style.transform = `translate(${face.x + face.width / 2}px, ${face.y + face.height / 2}px) translate(-50%, -50%)`;
    const stack = document.elementsFromPoint(face.x + face.width / 2, face.y + face.height / 2);
    return { spot: stack.findIndex((el) => el === spot || spot.contains(el)), face: stack.findIndex((el) => el.closest('.orbit-face')) };
  });
  expect(order.spot).toBeGreaterThanOrEqual(0);
  expect(order.face).toBeGreaterThanOrEqual(0);
  expect(order.spot, 'dot is on top of Orbit').toBeLessThan(order.face);

  // A fact card covers everything, Orbit included.
  await page.getByTestId('spot-sky').focus();
  await expect(page.getByTestId('spot-sky')).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  const cardOnTop = await page.evaluate(() => {
    const face = document.querySelector('.orbit-face')!.getBoundingClientRect();
    const top = document.elementsFromPoint(face.x + face.width / 2, face.y + face.height / 2)[0];
    return !!top.closest('.fact-overlay');
  });
  expect(cardOnTop).toBe(true);
});

test('the portraits carry no local file paths or other text in their metadata', () => {
  for (const mood of ['neutral', 'happy', 'thinking']) {
    const bytes = readFileSync(`public/images/orbit-${mood}.png`);
    const text = bytes.toString('latin1');
    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/Untitled|\.blend/);
    for (const chunk of ['tEXt', 'iTXt', 'zTXt']) expect(text).not.toContain(chunk);
  }
});
