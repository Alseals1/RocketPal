import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';
import { readFileSync } from 'node:fs';

// The Moon and Jupiter fly-by views (#43): a real NASA photo through a cockpit window, 3 dots, a "find 3" mission and a
// one-question postcard. Found dots stay found after leaving, coming back and reloading.

interface Arrival {
  place: string;
  title: string;
  credit: string;
  images: { high: string; low: string };
  hotspots: { id: string; title: string }[];
}
interface Pool {
  place: string;
  format: string;
  questions: { question: string; because: string; options: { text: string; correct: boolean }[] }[];
}
const arrivals = (JSON.parse(readFileSync('public/data/surfaces.json', 'utf8')) as { surfaces: Arrival[] }).surfaces;
const pools = (JSON.parse(readFileSync('public/data/quizzes.json', 'utf8')) as { pools: Pool[] }).pools;
const missions = (JSON.parse(readFileSync('public/data/missions.json', 'utf8')) as { missions: { place: string; title: string; done: string }[] })
  .missions;
const arrivalOf = (place: string) => arrivals.find((a) => a.place === place)!;
const missionOf = (place: string) => missions.find((m) => m.place === place)!;

const WORLDS = [
  { id: 'moon', name: 'the Moon' },
  { id: 'jupiter', name: 'Jupiter' },
];
const SIZES = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];

interface DebugHandle {
  getMode(): string;
  dockAt(id: string): void;
  getStars(id: string): number;
  isLookTurning(): boolean;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;
const dockAt = (page: Page, place: string) =>
  page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt(id), place);
const stars = (page: Page, place: string) =>
  page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.getStars(id), place);

function watchForErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Every request must stay on this computer: nothing is fetched from the internet. */
function watchForOutsideRequests(page: Page): string[] {
  const outside: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== 'localhost' && url.protocol !== 'data:' && url.protocol !== 'blob:') outside.push(req.url());
  });
  return outside;
}

async function waitForGame(page: Page) {
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await fontsReady(page);
}

async function start(page: Page, query = '&quality=high') {
  await page.goto(`/?debug=1${query}`);
  await waitForGame(page);
}

async function arrive(page: Page, place: string) {
  await dockAt(page, place);
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  expect(await debug(page, (h) => h.getMode())).toBe('surface');
}

async function backToSpace(page: Page) {
  await page.getByTestId('back-to-space').click();
  await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
}

/** Opens one dot's card from the keyboard (focus brings the dot into view, Enter opens it) and closes it with Escape. */
async function findByKeyboard(page: Page, place: string, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await expect(page.locator('#fact-title')).toHaveText(arrivalOf(place).hotspots.find((h) => h.id === id)!.title);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fact-card')).toBeHidden();
  await expect(spot).toHaveClass(/is-found/);
}

/** Answers the postcard: one wrong answer first (the kid can retry), then the right one. */
async function answerPostcard(page: Page, place: string) {
  const pool = pools.find((p) => p.place === place)!;
  expect(pool.format).toBe('postcard');
  await expect(page.getByTestId('quiz-step')).toHaveText('Question 1 of 1');
  const text = (await page.getByTestId('quiz-question').textContent())!.trim();
  const question = pool.questions.find((q) => q.question === text)!;
  expect(question, text).toBeDefined();
  const shown = await Promise.all([0, 1, 2].map(async (i) => (await page.getByTestId(`quiz-option-${i}`).textContent())!.trim()));
  const right = shown.indexOf(question.options.find((o) => o.correct)!.text);
  const wrong = [0, 1, 2].find((i) => i !== right)!;
  await page.getByTestId(`quiz-option-${wrong}`).click();
  await expect(page.getByTestId('quiz-feedback')).toContainText(/not quite/i);
  await expect(page.getByTestId('quiz-card')).toBeVisible(); // a wrong answer never ends it
  await page.getByTestId(`quiz-option-${right}`).click();
  await expect(page.getByTestId('quiz-because')).toHaveText(question.because);
  await expect(page.getByTestId('quiz-next')).toHaveText('See my stars');
  await page.getByTestId('quiz-next').click();
  await expect(page.getByTestId('quiz-stars')).toBeVisible();
}

for (const world of WORLDS) {
  test.describe(`${world.name} fly-by`, () => {
    for (const size of SIZES) {
      test(`by keyboard at ${size.width}x${size.height}: find 3, postcard, and the dots stay found`, async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchForErrors(page);
        const outside = watchForOutsideRequests(page);
        await page.setViewportSize(size);
        await start(page);
        await arrive(page, world.id);

        const arrival = arrivalOf(world.id);
        await expect(page.locator('.surface-hud')).toHaveClass(/is-flyby/);
        await expect(page.locator('.window-frame.is-cockpit')).toHaveCount(1);
        await expect(page.locator('.surface-title')).toContainText(`Flying past ${world.name}`);
        await expect(page.getByTestId('photo-credit')).toHaveText(`Photo: ${arrival.credit}`);
        await expect(page.getByTestId('found')).toHaveText('Found 0 of 3');
        await expect(page.getByTestId('mission')).toHaveText(`Mission: ${missionOf(world.id).title}`);
        expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/land(ed|ing)/i);

        for (const spot of arrival.hotspots) await findByKeyboard(page, world.id, spot.id);
        await expect(page.getByTestId('found')).toHaveText('Found 3 of 3');
        await expect(page.getByTestId('orbit')).toHaveText(missionOf(world.id).done);
        await expect(page.getByTestId('mission')).toHaveText(`✓ ${missionOf(world.id).title}`);
        expect(await stars(page, world.id)).toBe(1);

        await page.getByTestId('quiz-time').click();
        await answerPostcard(page, world.id);
        expect(await stars(page, world.id)).toBe(2); // done, but not right on the first try: no bonus star
        await page.getByTestId('quiz-close').click();

        await backToSpace(page);
        await arrive(page, world.id);
        await expect(page.getByTestId('found')).toHaveText('Found 3 of 3');
        await expect(page.getByTestId('orbit')).toHaveText('You found everything here! Tap a dot to read it again.');

        await page.reload();
        await waitForGame(page);
        await arrive(page, world.id);
        await expect(page.getByTestId('found')).toHaveText('Found 3 of 3');
        for (const spot of arrival.hotspots) await expect(page.getByTestId(`spot-${spot.id}`)).toHaveClass(/is-found/);
        expect(await stars(page, world.id)).toBe(2);

        expect(errors).toEqual([]);
        expect(outside).toEqual([]);
      });
    }

    test.describe('by touch', () => {
      test.use({ hasTouch: true });
      for (const size of [SIZES[1], SIZES[2]]) {
        test(`tapping each dot at ${size.width}x${size.height} finds it`, async ({ page }) => {
          const errors = watchForErrors(page);
          await page.setViewportSize(size);
          await start(page, '&quality=high&touch=1');
          await arrive(page, world.id);
          for (const spot of arrivalOf(world.id).hotspots) {
            const button = page.getByTestId(`spot-${spot.id}`);
            await button.focus(); // brings a dot that is off the screen into view, as a drag would
            await expect(button).toHaveCSS('opacity', '1', { timeout: 5000 });
            await expect.poll(() => debug(page, (h) => h.isLookTurning())).toBe(false); // tap where the dot has stopped
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
            const box = (await button.boundingBox())!;
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            await expect(page.getByTestId('fact-card')).toBeVisible();
            await page.getByTestId('close-card').tap();
            await expect(page.getByTestId('fact-card')).toBeHidden();
          }
          await expect(page.getByTestId('found')).toHaveText('Found 3 of 3');
          await expect(page.getByTestId('quiz-time')).toBeVisible();
          expect(errors).toEqual([]);
        });
      }
    });

    test('low quality loads the 1024 photo, and nothing is downloaded before arriving', async ({ page }) => {
      const photos: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/textures/surfaces/')) photos.push(new URL(req.url()).pathname);
      });
      await start(page, '&quality=low');
      expect(photos).toEqual([]);
      await arrive(page, world.id);
      expect(photos).toEqual([arrivalOf(world.id).images.low]);
    });

    test('with huge text and reduced motion, nothing is cut off', async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'on' })),
      );
      const errors = watchForErrors(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await start(page, '&quality=high&touch=1');
      await arrive(page, world.id);
      for (const selector of ['.surface-title', '.flyby-credit', '.orbit', '[data-testid="back-to-space"]']) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x, selector).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(391);
        expect(box.y + box.height, selector).toBeLessThanOrEqual(845);
      }
      expect(errors).toEqual([]);
    });
  });
}

test('if the Moon photo cannot load, the plain card still says "flying past" and never "landed"', async ({ page }) => {
  const errors = watchForErrors(page, [/Failed to load resource/, /Could not load/]);
  await page.route('**/textures/surfaces/moon-*.jpg', (route) => route.abort());
  await start(page);
  await dockAt(page, 'moon');
  await expect(page.getByTestId('landed')).toBeVisible();
  await expect(page.locator('#landed-title')).toHaveText('You are flying past The Moon!');
  await expect(page.getByTestId('landed')).toContainText('We are zooming past for a look.');
  await expect(page.getByTestId('landed')).not.toContainText(/land(ed|ing)|no solid ground/i);
  expect(errors).toEqual([]);
});

test('docked at Jupiter, the space screen says "Great flying!", never "Great landing!"', async ({ page }) => {
  await page.route('**/textures/surfaces/jupiter-*.jpg', (route) => route.abort());
  await start(page);
  await dockAt(page, 'jupiter');
  await expect(page.getByTestId('landed')).toBeVisible();
  await expect(page.locator('#landed-title')).toHaveText('You are flying past Jupiter!');
  await expect(page.locator('.stats-line').first()).toHaveText('Great flying!');
});
