import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

interface SurfaceFile {
  surfaces: {
    worldId: string;
    credit: string;
    creditNote: string;
    description: string;
    photo?: { horizontalFov: number; verticalFov: number };
    hotspots: { id: string; label: string; title: string; text: string; azimuth: number }[];
  }[];
}
const surfaces = JSON.parse(readFileSync('public/data/surfaces.json', 'utf8')) as SurfaceFile;
const earth = surfaces.surfaces.find((s) => s.worldId === 'earth')!;

interface DebugHandle {
  getMode(): string;
  getLook(): { azimuth: number; elevation: number } | undefined;
  isLookTurning(): boolean;
  getViewFov(): { horizontalFov: number; verticalFov: number } | undefined;
  setBackdrop(color: number): void;
  getFound(): number;
  hasPanorama(): boolean;
  getShip(): { docked: boolean };
  dockAt(id: string): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

/** A pretend voice that starts reading straight away (headless Chrome has no voices). */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(`
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [{ lang: 'en-US', localService: true, name: 'Pretend' }],
               speak(u) { setTimeout(() => u.onstart && u.onstart(new Event('start')), 0); }, cancel() {} },
      configurable: true,
    });`);
});

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function landAtEarth(page: Page, query = '&quality=high') {
  await page.goto(`/?debug=1${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
}

/** Looks at the real 3D picture and says where the green aurora and the reddish-brown solar panel are. */
async function pictureStats(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = copy.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let green = 0;
    let orange = 0;
    let orangeX = 0;
    let orangeY = 0;
    let total = 0;
    for (let y = 0; y < copy.height; y += 2) {
      for (let x = 0; x < copy.width; x += 2) {
        const i = (y * copy.width + x) * 4;
        const [r, gr, b] = [data[i], data[i + 1], data[i + 2]];
        total++;
        if (gr > 90 && gr > r * 1.25 && gr > b * 1.1) green++; // the green aurora
        // The solar array is very dark (measured about rgb(10, 2, 0) on screen): nearly black, with a red tint the dark sky lacks.
        if (r >= 7 && r > gr * 2.5 && r > b * 4) {
          orange++; // the solar array
          orangeX += x / copy.width;
          orangeY += y / copy.height;
        }
      }
    }
    return { greenShare: green / total, orangeShare: orange / total, orangeX: orange ? orangeX / orange : 0, orangeY: orange ? orangeY / orange : 0 };
  });
}

async function reachSpot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  return spot;
}

test('landing at Earth puts you at a space station window, looking at a real NASA photo', async ({ page }) => {
  const errors = watchForErrors(page);
  await landAtEarth(page);

  await expect(page.locator('.surface-title')).toContainText('Earth from the Space Station');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 6');
  // The credit is in the words NASA asks for, names the photo, and says what is drawn.
  await expect(page.getByTestId('photo-credit')).toContainText(earth.credit);
  await expect(page.getByTestId('photo-credit')).toContainText('iss073e0247726');
  await expect(page.getByTestId('photo-credit')).toContainText('The window frame is drawn.');
  await expect(page.getByTestId('orbit')).toContainText("I'm Orbit");
  // The picture describes itself truthfully for people who cannot see it: not a 360 degree picture, not taken by a rover.
  const label = (await page.locator('#game-canvas canvas').getAttribute('aria-label'))!;
  expect(label).toBe(earth.description);
  expect(label).toMatch(/astronaut/i);
  expect(label).toMatch(/window/i);
  expect(label).not.toMatch(/360|rover/i);

  // The picture really is the photo, the right way round: green aurora is plentiful, and the solar panel
  // is in the lower RIGHT of the screen (a mirrored picture would put it lower left).
  const picture = await pictureStats(page);
  expect(picture.greenShare).toBeGreaterThan(0.015);
  expect(picture.orangeShare).toBeGreaterThan(0.002);
  expect(picture.orangeX).toBeGreaterThan(0.6);
  expect(picture.orangeY).toBeGreaterThan(0.6);
  expect(errors).toEqual([]);
});

test('the drawn window frame is there but never blocks a tap', async ({ page }) => {
  await landAtEarth(page);
  const frame = page.locator('.window-frame');
  await expect(frame).toBeAttached();
  await expect(frame).toHaveCSS('pointer-events', 'none');
  await expect(frame).toHaveAttribute('aria-hidden', 'true');

  // A dot close to the edge of the picture can still be tapped with a real mouse click.
  const spot = await reachSpot(page, 'array');
  const box = (await spot.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await expect(page.getByTestId('found')).toHaveText('Found 1 of 6');
});

test('every dot opens a card with its own NASA-checked words, and Orbit keeps count', async ({ page }) => {
  const errors = watchForErrors(page);
  await landAtEarth(page);

  let found = 0;
  for (const spot of earth.hotspots) {
    const button = await reachSpot(page, spot.id);
    await button.press('Enter');
    const card = page.getByTestId('fact-card');
    await expect(card).toBeVisible();
    await expect(card.locator('h2')).toHaveText(spot.title);
    await expect(card.locator('.fact-text')).toHaveText(spot.text);
    await expect(card.locator('.fact-source')).toHaveText("Facts from NASA's website. Checked October 23, 2026.");
    await expect(page.getByTestId('listen')).toHaveText('Listen');
    found++;
    await expect(page.getByTestId('found')).toHaveText(`Found ${found} of ${earth.hotspots.length}`);
    await page.getByTestId('close-card').click();
    await expect(card).toBeHidden();
  }
  await expect(page.getByTestId('orbit')).toContainText('You found everything here');
  expect(errors).toEqual([]);
});

test.describe('how far you can look round', () => {
  const PHOTO_WIDE = 73.74; // degrees across, from the 24 mm lens
  const offsetFromMiddle = (azimuth: number) => ((azimuth + 540) % 360) - 180;
  const viewFov = (page: Page) => debug(page, (h) => h.getViewFov()!);
  /** Drags the picture hard in a direction (a very long drag, so it must stop at the limit). */
  const dragFar = async (page: Page, dx: number, dy: number) => {
    const box = (await page.locator('#game-canvas canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
    return (await debug(page, (h) => h.getLook()))!;
  };
  /** How many pixels of the 3D picture are the bright magenta test backdrop, which means empty space past the edge of the photo. */
  const gapPixels = (page: Page) =>
    page.evaluate(() => {
      const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const g = copy.getContext('2d')!;
      g.drawImage(canvas, 0, 0);
      const d = g.getImageData(0, 0, copy.width, copy.height).data;
      let gap = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 2] > 200 && d[i + 1] < 80) gap++;
      return gap;
    });

  test('on a wide screen the photo exactly fills the window, so there is nothing to look round', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await landAtEarth(page);
    // The camera zoomed in until the screen sees exactly the photo's width: 73.74 degrees across.
    expect((await viewFov(page)).horizontalFov).toBeCloseTo(PHOTO_WIDE, 1);
    for (const [dx, dy] of [[-3000, 0], [3000, 0], [0, 3000], [0, -3000]]) {
      const look = await dragFar(page, dx, dy);
      expect(Math.abs(offsetFromMiddle(look.azimuth)), `dragging ${dx},${dy}`).toBeLessThan(0.1);
      expect(Math.abs(look.elevation), `dragging ${dx},${dy}`).toBeLessThan(0.1);
    }
  });

  test('on a tall phone the camera zooms in a little, and you can look as far sideways as the photo reaches', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await landAtEarth(page);
    const fov = await viewFov(page);
    expect(fov.verticalFov).toBeLessThan(50); // zoomed in a little, so no corner of the screen can leave the photo
    expect(fov.verticalFov).toBeGreaterThan(40);
    const reach = (PHOTO_WIDE - fov.horizontalFov) / 2; // the whole width of the photo can be reached
    for (const dx of [-3000, 3000]) {
      const look = await dragFar(page, dx, 0);
      expect(Math.abs(offsetFromMiddle(look.azimuth)), `dragging ${dx}`).toBeGreaterThan(reach - 0.3);
      expect(Math.abs(offsetFromMiddle(look.azimuth)), `dragging ${dx}`).toBeLessThan(reach + 0.01);
    }
  });

  test('looking as far as you can in every direction on a tall phone never shows empty space beyond the photo', async ({ page }) => {
    // The empty space around the photo is painted bright magenta for this test, so any gap is easy to see.
    // (An earlier version showed a black wedge in the top corner when you looked fully sideways and then up.)
    for (const size of [
      { width: 390, height: 844 },
      { width: 420, height: 900 },
      { width: 600, height: 800 },
    ]) {
      await page.setViewportSize(size);
      await landAtEarth(page);
      await debug(page, (h) => h.setBackdrop(0xff00ff));
      for (const [dx, dy] of [[-3000, 3000], [3000, 3000], [-3000, -3000], [3000, -3000], [-3000, 0], [3000, 0], [0, 3000], [0, -3000]]) {
        await dragFar(page, dx, dy);
        await page.waitForTimeout(100); // let a frame draw
        expect(await gapPixels(page), `${size.width}x${size.height} after dragging ${dx},${dy}`).toBeLessThan(3);
      }
    }
  });

  test('turning the phone while you look out of the window: the view re-zooms and the limits follow the new shape', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 }); // wide: the photo exactly fills the screen
    await landAtEarth(page);
    expect(Math.abs(offsetFromMiddle((await dragFar(page, -3000, 0)).azimuth))).toBeLessThan(0.1);

    // Now turn it upright: a tall screen can look sideways.
    await page.setViewportSize({ width: 420, height: 900 });
    await expect.poll(async () => (await viewFov(page)).horizontalFov, { timeout: 5000 }).toBeLessThan(40); // a tall screen sees much less across
    const fov = await viewFov(page);
    const reach = (PHOTO_WIDE - fov.horizontalFov) / 2;
    await expect.poll(async () => Math.abs(offsetFromMiddle((await dragFar(page, -3000, 0)).azimuth)), { timeout: 5000 }).toBeGreaterThan(reach - 0.3);
    // ...but exactly as far as the new shape allows, and no further.
    expect(Math.abs(offsetFromMiddle((await dragFar(page, -3000, 0)).azimuth))).toBeLessThan(reach + 0.01);

    // And back to wide: the view is pulled back to the middle at once, not left looking past the photo.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => Math.abs(offsetFromMiddle((await debug(page, (h) => h.getLook())!)!.azimuth)), { timeout: 5000 }).toBeLessThan(0.1);
  });

  test('arrow keys stop at the same edge', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await landAtEarth(page);
    const reach = (PHOTO_WIDE - (await viewFov(page)).horizontalFov) / 2;
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => offsetFromMiddle((await debug(page, (h) => h.getLook()))!.azimuth), { timeout: 20_000 })
      .toBeGreaterThan(reach - 0.3);
    await page.waitForTimeout(500); // keep holding: it must not go past the edge
    await page.keyboard.up('ArrowRight');
    expect(offsetFromMiddle((await debug(page, (h) => h.getLook()))!.azimuth)).toBeLessThan(reach + 0.01);
  });

  test('a dot just past the screen on a tall phone swings into view, and stops at the edge of the photo', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await landAtEarth(page);
    const array = page.getByTestId('spot-array'); // 28 degrees to the right: past what the phone sees at first
    await expect(array).toHaveCSS('opacity', '0');
    await array.focus();
    await expect(array).toHaveCSS('opacity', '1', { timeout: 5000 });
    await expect.poll(() => debug(page, (h) => h.isLookTurning())).toBe(false);
    const look = (await debug(page, (h) => h.getLook()))!;
    const reach = (PHOTO_WIDE - (await viewFov(page)).horizontalFov) / 2;
    expect(offsetFromMiddle(look.azimuth)).toBeGreaterThan(reach - 0.3); // as far as it can go
    expect(offsetFromMiddle(look.azimuth)).toBeLessThan(reach + 0.01); // and no further
  });
});

test('low quality uses the small photo, high quality the sharp one, and nothing is downloaded before landing', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/textures/surfaces/')) requested.push(r.url().split('/').pop()!);
  });
  await page.goto('/?debug=1&quality=low');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.waitForTimeout(1200);
  expect(requested).toEqual([]);
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(requested).toEqual(['earth-iss-2048.jpg']);

  requested.length = 0;
  await landAtEarth(page, '&quality=high');
  expect(requested).toEqual(['earth-iss-4096.jpg']);
});

test('Back to space lifts off, and Earth is then "you\'re here"', async ({ page }) => {
  await landAtEarth(page);
  await page.getByTestId('back-to-space').click();
  await expect(page.locator('.surface-title')).toBeHidden();
  expect(await debug(page, (h) => h.getMode())).toBe('space');
  expect(await debug(page, (h) => h.hasPanorama())).toBe(false); // the photo is thrown away
  expect((await debug(page, (h) => h.getShip())).docked).toBe(false);
  await page.getByTestId('where-button').click();
  await expect(page.getByRole('button', { name: /Earth/ })).toBeDisabled();
});

test('going from Earth to Mars and back swaps the view each time, with the right credit', async ({ page }) => {
  await landAtEarth(page);
  await expect(page.locator('.surface-title')).toContainText('Earth from the Space Station');
  await page.getByTestId('back-to-space').click();
  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.surface-title')).toContainText('Jezero Crater, Mars');
  await expect(page.locator('.window-frame')).toHaveCount(0); // Mars is a 360 degree picture: no window frame
  await expect(page.getByTestId('photo-credit')).toContainText('NASA/JPL-Caltech/MSSS/ASU');
  await page.getByTestId('back-to-space').click();
  await debug(page, (h) => h.dockAt('earth'));
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.window-frame')).toHaveCount(1);
  await expect(page.getByTestId('photo-credit')).toContainText('Earth Science and Remote Sensing Unit');
  await expect(page.getByTestId('found')).toHaveText('Found 0 of 6');
});

test.describe('on small screens with the biggest text', () => {
  test('nothing sits on top of anything else, and every button is a big target', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
    );
    for (const size of [
      { width: 420, height: 900 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await landAtEarth(page, '&quality=high&touch=1');
      const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      const title = await box('.surface-title');
      const back = await box('[data-testid="back-to-space"]');
      const gear = await box('[data-testid="settings-button"]');
      const orbit = await box('.orbit');
      expect(overlaps(title, back), `title over Back at ${size.width}`).toBe(false);
      expect(overlaps(back, gear), `Back over settings at ${size.width}`).toBe(false);
      expect(overlaps(title, gear), `title over settings at ${size.width}`).toBe(false);
      expect(overlaps(title, orbit), `title over Orbit at ${size.width}`).toBe(false);
      const credit = await box('[data-testid="photo-credit"]');
      expect(credit.x + credit.width).toBeLessThanOrEqual(title.x + title.width + 1);
      for (const b of [back, gear]) {
        expect(b.height).toBeGreaterThanOrEqual(56);
        expect(b.width).toBeGreaterThanOrEqual(56);
      }
      // The sky dot is at least 56 px, and its card can be opened and closed.
      const spot = await reachSpot(page, 'clouds');
      const dot = (await spot.boundingBox())!;
      expect(dot.width).toBeGreaterThanOrEqual(56);
      await spot.press('Enter');
      const done = page.getByTestId('close-card');
      await done.scrollIntoViewIfNeeded();
      expect((await done.boundingBox())!.x + (await done.boundingBox())!.width).toBeLessThanOrEqual(size.width);
      await done.click();
    }
  });
});

test('Listen on an Earth card reads the title and the words', async ({ page }) => {
  await page.addInitScript(`
    window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [{ lang: 'en-US', localService: true, name: 'Pretend' }],
               speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onstart && u.onstart(new Event('start')), 0); }, cancel() {} },
      configurable: true,
    });`);
  await landAtEarth(page);
  await (await reachSpot(page, 'speed')).press('Enter');
  await page.getByTestId('listen').click();
  const speed = earth.hotspots.find((h) => h.id === 'speed')!;
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual([`${speed.title}. ${speed.text}`]);
});

test('in the finished picture each dot really sits on what it describes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await landAtEarth(page);
  /** The average colour of a small patch of the 3D picture under the middle of a dot (the dot itself is on top of the picture, not in it). */
  const colourUnder = async (id: string) => {
    const spot = page.getByTestId(`spot-${id}`);
    await expect(spot).toHaveCSS('opacity', '1');
    const box = (await spot.boundingBox())!;
    return page.evaluate(
      ([cx, cy]) => {
        const canvas = document.querySelector('#game-canvas canvas') as HTMLCanvasElement;
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const g = copy.getContext('2d')!;
        g.drawImage(canvas, 0, 0);
        const scale = canvas.width / canvas.getBoundingClientRect().width;
        const half = 7;
        const d = g.getImageData(Math.round(cx * scale) - half, Math.round(cy * scale) - half, half * 2, half * 2).data;
        let r = 0, gr = 0, b = 0;
        const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          gr += d[i + 1];
          b += d[i + 2];
        }
        return { r: r / n, g: gr / n, b: b / n };
      },
      [box.x + box.width / 2, box.y + box.height / 2],
    );
  };

  const aurora = await colourUnder('aurora');
  expect(aurora.g, 'aurora is green').toBeGreaterThan(aurora.r * 1.1);
  expect(aurora.g).toBeGreaterThan(60);

  const array = await colourUnder('array');
  expect(array.r, 'solar array is a dark reddish brown').toBeGreaterThan(array.g * 2);
  expect(array.r).toBeLessThan(80);
  expect(array.r).toBeGreaterThanOrEqual(5);

  const clouds = await colourUnder('clouds');
  expect(clouds.r + clouds.g + clouds.b, 'clouds are bright').toBeGreaterThan(150);

  const sky = await colourUnder('speed');
  expect(sky.r + sky.g + sky.b, 'the dot in the sky is over dark sky').toBeLessThan(45);
});
