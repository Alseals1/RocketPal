/**
 * The Star Map (#42, docs/VISUAL_DESIGN.md 7.4): the track of worlds that replaced "Where to?". Picking by keyboard,
 * mouse and touch, the words a screen reader hears, real distances, phone layouts, and sizes at every text size.
 */
import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';
import { openStarMap } from './starMap.ts';

interface DebugHandle {
  getShip(): { position: { x: number; y: number; z: number }; yaw: number; pitch: number; docked: boolean };
  getTargetId(): string | null;
  getStars(id: string): number;
  getFps(): number;
  dockAt(id: string): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

const WORLDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const NAMES: Record<string, string> = {
  sun: 'The Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'The Moon',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
};
const SIZES = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];
const TEXT_SIZES = ['normal', 'big', 'huge'];
/** An old (version 1) save with Mars' mission and quiz done: it moves over to 2.0 with stars on Mars. */
const MARS_SAVE = JSON.stringify({ version: 1, worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: false } } });

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

const map = (page: Page) => page.getByTestId('star-map');
const node = (page: Page, id: string) => page.getByTestId(`star-map-node-${id}`);
/** Waits until the sheet has risen in and the nodes have stopped moving, so boxes can be measured. */
const settled = async (page: Page) => {
  await expect.poll(() => map(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await page.waitForTimeout(700); // the first-open stagger and a real-distance move (600 ms)
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const overlaps = (a: Rect, b: Rect) =>
  a.width > 1 && a.height > 1 && b.width > 1 && b.height > 1 &&
  a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

/** Every node's box on the track (not cut by the scroller): what overlap means for the track itself. */
const nodeBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.star-map__node')].map((el) => {
      const r = el.getBoundingClientRect();
      const track = el.closest('ol')!.getBoundingClientRect();
      return { id: el.dataset.world!, x: r.x, y: r.y, width: r.width, height: r.height, onTrack: r.x - track.x };
    }),
  );

/** Every button in the Star Map that shows, with its box cut to every scrolling panel round it. */
const shownButtons = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="star-map"] button')]
      .filter((el) => el.getClientRects().length > 0)
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (!/auto|scroll|hidden/.test(getComputedStyle(p).overflowY + getComputedStyle(p).overflowX)) continue;
          const c = p.getBoundingClientRect();
          [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
        }
        return {
          id: el.dataset.testid ?? `button#${i}`,
          isNode: el.classList.contains('star-map__node'),
          primary: el.classList.contains('rp-button--primary'),
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          shown: { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) },
          // Every part inside (the words, the picture, the stars) sits inside the button: nothing is cut off.
          fits: [...el.querySelectorAll('*')].every((c) => {
            const b = c.getBoundingClientRect();
            return b.width === 0 || (b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1);
          }),
        };
      }),
  );

test.describe('opening it', () => {
  test('the Star Map button and M open it: all 10 worlds in order in one ordered list, each with a picture, name and stars', async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page);
    await expect(page.getByTestId('where-button')).toHaveCount(0); // "Where to?" is gone
    await expect(page.locator('.picker')).toHaveCount(0);
    const button = page.getByTestId('star-map-button');
    await expect(button).toHaveAccessibleName('Star Map');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await openStarMap(page);
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(map(page)).toHaveAttribute('role', 'dialog');
    await expect(map(page)).toHaveAttribute('aria-modal', 'true');
    await expect(map(page)).toHaveAccessibleName('Star Map');
    expect(await page.locator('ol.star-map__track > li .star-map__node').evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.world))).toEqual(WORLDS);
    for (const id of WORLDS) {
      await expect(node(page, id).locator('img')).toHaveAttribute('src', `/thumbnails/${id}.webp`);
      await expect(node(page, id).locator('img')).toHaveAttribute('alt', '');
      await expect(node(page, id)).toContainText(NAMES[id]);
      await expect(node(page, id).locator('.rp-star')).toHaveCount(3);
    }
    await expect(page.getByTestId('scale-note')).toHaveText(/not to scale/);
    await page.keyboard.press('Escape');
    await expect(map(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.activeElement?.classList.contains('stage'))).toBe(true);

    await page.keyboard.press('KeyM');
    await expect(map(page)).toBeVisible();
    await page.getByTestId('star-map-close').click();
    await expect(map(page)).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('M does nothing while docked, while Mission Control is open, or on a world', async ({ page }) => {
    await start(page);
    await page.getByTestId('menu-button').click();
    await expect(page.getByTestId('mission-control')).toBeVisible();
    await page.keyboard.press('KeyM');
    await expect(map(page)).toBeHidden();
    await page.getByTestId('mission-control-close').click();

    await debug(page, (h) => h.dockAt('mercury')); // no photo: the plain landing card
    await expect(page.getByTestId('landed')).toBeVisible();
    await expect(page.getByTestId('star-map-button')).toBeHidden();
    await page.keyboard.press('KeyM');
    await expect(map(page)).toBeHidden();
    await page.getByTestId('fly-again').click();

    await debug(page, (h) => h.dockAt('mars')); // a photo: the surface
    await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
    await page.keyboard.press('KeyM');
    await expect(map(page)).toBeHidden();
  });

  test('the autopilot can arrive with the map open: it closes for the landing', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    await debug(page, (h) => h.dockAt('mercury'));
    await expect(map(page)).toBeHidden();
    await expect(page.getByTestId('landed')).toBeVisible();
  });
});

test.describe('picking a world', () => {
  test('every world can be picked with the keyboard alone: arrows, Enter, Enter', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchForErrors(page);
    await start(page);
    for (const [i, id] of WORLDS.entries()) {
      await page.keyboard.press('KeyM');
      await expect(map(page)).toBeVisible();
      await page.keyboard.press('Home');
      await expect(node(page, 'sun')).toBeFocused();
      for (let k = 0; k < i; k++) await page.keyboard.press('ArrowRight');
      await expect(node(page, id)).toBeFocused();
      if (((await node(page, id).getAttribute('aria-label')) ?? '').endsWith('you are here')) {
        await page.keyboard.press('Escape');
        continue;
      }
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('star-map-detail')).toBeVisible();
      await expect(page.getByTestId('set-course')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(map(page)).toBeHidden();
      expect(await debug(page, (h) => h.getTargetId())).toBe(id);
      await expect(page.getByTestId('autopilot-button')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('the track is one Tab stop, the arrows stop at the ends, Home and End jump, and Tab stays inside', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    expect(await page.locator('.star-map__node').evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex === 0).length)).toBe(1);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowLeft');
    await expect(node(page, 'sun')).toBeFocused();
    await page.keyboard.press('End');
    await expect(node(page, 'neptune')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(node(page, 'neptune')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(node(page, 'uranus')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(node(page, 'neptune')).toBeFocused();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await map(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });

  test('Escape closes the panel and puts focus back on its node, then a second Escape closes the map', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('set-course')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('star-map-detail')).toBeHidden();
    await expect(node(page, 'neptune')).toBeFocused();
    await expect(map(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(map(page)).toBeHidden();
    await expect(page.getByTestId('mission-control')).toBeHidden(); // a closing Escape never opens Mission Control
  });

  test('with a mouse: one click opens the panel, a second click on the node sets course', async ({ page }) => {
    await start(page);
    for (const id of ['jupiter', 'moon']) {
      await openStarMap(page);
      await node(page, id).click();
      await expect(node(page, id)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('star-map-detail')).toContainText(NAMES[id]);
      await expect(map(page)).toBeVisible();
      await node(page, id).click();
      await expect(map(page)).toBeHidden();
      expect(await debug(page, (h) => h.getTargetId())).toBe(id);
    }
    await openStarMap(page);
    await node(page, 'saturn').click();
    await page.getByTestId('set-course').click();
    expect(await debug(page, (h) => h.getTargetId())).toBe('saturn');
  });

  test('the panel shows the hook, a distance line and stars; the Sun and the Moon say it their own way', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    await node(page, 'jupiter').click();
    const detail = page.getByTestId('star-map-detail');
    await expect(detail).toHaveAccessibleName('Jupiter');
    await expect(page.getByTestId('star-map-distance')).toHaveText(/^[\d.,]+ million km from the Sun · light takes \d+ minutes?$/);
    await expect(detail.locator('.rp-stars')).toBeVisible();
    await node(page, 'sun').click();
    await expect(page.getByTestId('star-map-distance')).toHaveText('The centre of our solar system');
    await node(page, 'moon').click();
    await expect(page.getByTestId('star-map-distance')).toHaveText(/^[\d.,]+ km from Earth · light takes [\d.]+ seconds?$/);
    expect(await detail.locator('.star-map__hook').innerText()).not.toBe('');
  });
});

test('on a touch screen: tap, tap', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = watchForErrors(page);
  await start(page, '&quality=high&touch=1');
  for (const id of ['mars', 'neptune', 'jupiter']) { // not the Sun: the rocket starts next to it
    await page.getByTestId('star-map-button').tap();
    await expect(map(page)).toBeVisible();
    await node(page, id).scrollIntoViewIfNeeded();
    await node(page, id).tap();
    await expect(page.getByTestId('star-map-detail')).toBeVisible();
    await node(page, id).tap();
    await expect(map(page)).toBeHidden();
    expect(await debug(page, (h) => h.getTargetId())).toBe(id);
  }
  expect(errors).toEqual([]);
  await context.close();
});

test.describe('words and stars', () => {
  test('every node says "<Name>, <nth> of 10, <n> star(s) of 3", and its stars match the save', async ({ page }) => {
    await page.addInitScript((save) => localStorage.setItem('rocketpals.progress', save), MARS_SAVE);
    await start(page);
    await openStarMap(page);
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
    let anyStars = false;
    for (const [i, id] of WORLDS.entries()) {
      const stars = await page.evaluate((w) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.getStars(w), id);
      const n = Math.min(3, Math.max(0, stars));
      anyStars ||= n > 0;
      await expect(node(page, id)).toHaveAttribute('data-stars', String(n));
      await expect(node(page, id).locator('.rp-star--filled')).toHaveCount(n);
      const label = `${NAMES[id]}, ${ordinals[i]} of 10, ${n} ${n === 1 ? 'star' : 'stars'} of 3`;
      await expect(node(page, id)).toHaveAccessibleName(new RegExp(`^${label}(, you are here)?$`));
    }
    expect(anyStars).toBe(true); // the seeded save really gave Mars stars
  });

  test('"You are here" shows on the world the rocket is next to, with no Set course', async ({ page }) => {
    await start(page);
    await debug(page, (h) => h.dockAt('mercury'));
    await page.getByTestId('fly-again').click();
    await openStarMap(page);
    const here = node(page, 'mercury');
    await expect(here).toHaveAccessibleName(/, you are here$/);
    await expect(here.locator('.star-map__pin')).toHaveText('You are here');
    await expect(here).toBeFocused(); // no target, so focus starts where you are
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('star-map-detail')).toContainText('You are here');
    await expect(page.getByTestId('set-course')).toBeHidden();
    await here.click(); // a second tap does nothing either
    await expect(map(page)).toBeVisible();
    await expect(page.locator('.star-map__pin')).toHaveCount(1);
  });
});

test('steering does nothing while it is open, but the scene keeps moving', async ({ page }) => {
  await start(page);
  /** How far the rocket turns while ArrowLeft is held for a moment. */
  const turnWhileHolding = async () => {
    const before = await debug(page, (h) => h.getShip());
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowLeft');
    const after = await debug(page, (h) => h.getShip());
    return { turn: Math.abs(after.yaw - before.yaw), moved: Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) };
  };
  await page.waitForTimeout(500); // the first frames settle
  await openStarMap(page);
  const open = await turnWhileHolding();
  expect(open.turn).toBeLessThan(0.05);
  expect(open.moved).toBeGreaterThan(0); // the Star Map does not pause the game: the rocket keeps cruising
  await page.keyboard.press('Escape');
  await expect(map(page)).toBeHidden();
  expect((await turnWhileHolding()).turn).toBeGreaterThan(0.2); // with the map closed the same key turns the rocket
});

test.describe('real distances', () => {
  test('the switch re-spaces the track and back, the note changes, and no two nodes ever overlap', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    await settled(page);
    const toggle = page.getByTestId('real-distance-toggle');
    await expect(toggle).toHaveAttribute('role', 'switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(map(page)).toHaveAttribute('data-scale', 'even');
    const even = await nodeBoxes(page);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(map(page)).toHaveAttribute('data-scale', 'real');
    await expect(page.getByTestId('scale-note')).toHaveText(/^Real distances!.*Sizes are not to scale\.$/);
    // Wait for the move to finish: Neptune stops changing.
    await expect.poll(async () => {
      const a = (await nodeBoxes(page))[9].onTrack;
      await page.waitForTimeout(150);
      return Math.abs((await nodeBoxes(page))[9].onTrack - a);
    }).toBeLessThan(0.5);
    const real = await nodeBoxes(page);
    const at = (boxes: { onTrack: number }[], i: number) => boxes[i].onTrack;
    // The outer worlds spread out: Neptune is much further from Saturn than before.
    expect(at(real, 9) - at(real, 7)).toBeGreaterThan(2 * (at(even, 9) - at(even, 7)));
    for (const boxes of [even, real]) {
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j]), `${boxes[i].id} / ${boxes[j].id}`).toBe(false);
      }
    }
    await toggle.click();
    // Back where they were once the 600 ms move is over (polled: a busy computer can run late).
    await expect.poll(async () => (await nodeBoxes(page)).map((b) => Math.round(b.onTrack))).toEqual(even.map((b) => Math.round(b.onTrack)));
  });

  test('with reduced motion the switch moves the nodes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    await openStarMap(page);
    const item = page.locator('.star-map__item').nth(8);
    expect(await item.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s/);
    const before = (await node(page, 'uranus').boundingBox())!.x;
    await page.getByTestId('real-distance-toggle').click();
    const after = (await node(page, 'uranus').boundingBox())!.x;
    expect(after).not.toBe(before);
  });
});

test('on a phone held upright the track runs top to bottom, Sun first, and the panel sits below it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await openStarMap(page);
  await settled(page);
  const boxes = await nodeBoxes(page);
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].height - 1);
  await node(page, 'mars').click();
  const detail = (await page.getByTestId('star-map-detail').boundingBox())!;
  const track = (await page.locator('.star-map__scroller').boundingBox())!;
  expect(detail.y).toBeGreaterThanOrEqual(track.y + track.height - 1);
  expect(detail.y + detail.height).toBeLessThanOrEqual(844 + 1);
});

test.describe('every size and text size', () => {
  for (const size of SIZES) {
    for (const text of TEXT_SIZES) {
      test(`nothing overlaps or is cut off at ${size.width}x${size.height}, ${text} text`, async ({ page }) => {
        test.setTimeout(120_000); // 10 worlds, both spacings
        await page.setViewportSize(size);
        await page.addInitScript((t) => localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: t, reducedMotion: 'system' })), text);
        const errors = watchForErrors(page);
        await start(page);
        await openStarMap(page);
        await settled(page);
        for (const real of [false, true]) {
          if (real) {
            await page.getByTestId('real-distance-toggle').click();
            await page.waitForTimeout(700);
          }
          for (const id of WORLDS) {
            await node(page, id).scrollIntoViewIfNeeded();
            await node(page, id).click();
            await page.waitForTimeout(250); // a snap scroll on short screens settles
            const buttons = await shownButtons(page);
            const label = `${size.width}x${size.height} ${text} ${real ? 'real' : 'even'} ${id}`;
            for (const b of buttons.filter((x) => x.shown.width > 0 && x.shown.height > 0)) {
              expect(b.box.height, `${label}: ${b.id} height`).toBeGreaterThanOrEqual(b.primary ? 64 : 56);
              expect(b.box.width, `${label}: ${b.id} width`).toBeGreaterThanOrEqual(56);
              expect(b.fits, `${label}: ${b.id} text fits`).toBe(true);
            }
            // The node just clicked and the panel's buttons are fully on screen, and nothing that shows overlaps.
            const clicked = buttons.find((b) => b.id === `star-map-node-${id}`)!;
            expect(clicked.shown.width, `${label}: node shows whole`).toBeGreaterThanOrEqual(clicked.box.width - 1);
            expect(clicked.shown.height, `${label}: node shows whole`).toBeGreaterThanOrEqual(clicked.box.height - 1);
            const shown = buttons.filter((b) => b.shown.width > 1 && b.shown.height > 1);
            for (let i = 0; i < shown.length; i++) {
              for (let j = i + 1; j < shown.length; j++) expect(overlaps(shown[i].shown, shown[j].shown), `${label}: ${shown[i].id} / ${shown[j].id}`).toBe(false);
            }
            const course = buttons.find((b) => b.id === 'set-course');
            if (course) {
              expect(course.shown.height, `${label}: Set course on screen`).toBeGreaterThanOrEqual(course.box.height - 1);
              expect(course.box.y + course.box.height, `${label}: Set course inside the window`).toBeLessThanOrEqual(size.height + 1);
            }
          }
        }
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe('modes', () => {
  test('in low quality the map has no blur and works', async ({ page }) => {
    const errors = watchForErrors(page);
    await start(page, '&quality=low');
    await openStarMap(page);
    expect(await map(page).evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none');
    await node(page, 'venus').click();
    await page.getByTestId('set-course').click();
    expect(await debug(page, (h) => h.getTargetId())).toBe('venus');
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
    await start(page);
    await openStarMap(page);
    await expect(node(page, 'mars')).toHaveAttribute('data-stars', '0');
    await node(page, 'mars').click();
    await page.getByTestId('set-course').click();
    expect(await debug(page, (h) => h.getTargetId())).toBe('mars');
  });

  test('the scene keeps drawing with the map open (the frame rate is checked by hand on a Chromebook)', async ({ page }) => {
    await start(page);
    await openStarMap(page);
    await page.waitForTimeout(2000);
    expect(await debug(page, (h) => h.getFps())).toBeGreaterThan(5); // headless and busy: only proves frames still come
  });
});
