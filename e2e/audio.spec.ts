import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/** The sound player (Howler) is its own file, fetched only after the first key or tap (#41). */
const isHowlerChunk = (url: string) => /\/assets\/howler-[^/]*\.js$/.test(url);
/** The sound effects (#34), preloaded once Howler is in. */
const isSoundFile = (url: string) => /\/sounds\/[a-z-]+\.wav$/.test(url);
const SOUND_COUNT = (JSON.parse(readFileSync('public/data/sounds.json', 'utf8')) as { sounds: unknown[] }).sounds.length;

interface QuizFile {
  pools: { place: string; questions: { question: string; options: { text: string; correct: boolean }[] }[] }[];
}
const marsQuiz = (JSON.parse(readFileSync('public/data/quizzes.json', 'utf8')) as QuizFile).pools.find((p) => p.place === 'mars')!.questions;

/**
 * Console errors, "Sound is off" warnings (a normal run must have none, #41 review F1), and requests for the sound
 * player and the sound files. `ignore` leaves out errors a test causes on purpose.
 */
function watch(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  const soundOff: string[] = [];
  const howlerRequests: string[] = [];
  const soundRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((re) => re.test(msg.text()))) errors.push(msg.text());
    if (msg.type() === 'warning' && msg.text().includes('Sound is off')) soundOff.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (request) => {
    if (isHowlerChunk(request.url())) howlerRequests.push(request.url());
    if (isSoundFile(request.url())) soundRequests.push(new URL(request.url()).pathname);
  });
  return { errors, soundOff, howlerRequests, soundRequests };
}

const played = (page: Page) => page.evaluate(() => (window as unknown as { rocketPals: { getSoundsPlayed(): string[] } }).rocketPals.getSoundsPlayed());
const dockAt = (page: Page, id: string) => page.evaluate((w) => (window as unknown as { rocketPals: { dockAt(id: string): void } }).rocketPals.dockAt(w), id);

async function landOnMars(page: Page) {
  await dockAt(page, 'mars');
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
}

/** Opens a dot's card with the keyboard and closes it again. */
async function findDot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await page.getByTestId('close-card').click();
  await expect(page.getByTestId('fact-card')).toBeHidden();
}

/** Where the right answer to the question on the card is (each quiz is a shuffled draw, so read the card). */
async function rightIndex(page: Page): Promise<number> {
  const text = (await page.getByTestId('quiz-question').textContent())!.trim();
  const right = marsQuiz.find((q) => q.question === text)!.options.find((o) => o.correct)!.text;
  for (let i = 0; i < 3; i++) if ((await page.getByTestId(`quiz-option-${i}`).textContent())!.trim() === right) return i;
  throw new Error(`no right answer on the card for "${text}"`);
}

/** Finds the three mission dots, then answers the first quiz question wrong and then right. */
async function missionAndFirstAnswers(page: Page) {
  for (const id of ['rim', 'ground', 'sky']) {
    await findDot(page, id);
    await page.waitForTimeout(200); // the same sound within 150 ms plays once, and a test is faster than any kid
  }
  await page.getByTestId('quiz-time').click();
  const right = await rightIndex(page);
  await page.getByTestId(`quiz-option-${(right + 1) % 3}`).click();
  await expect(page.getByTestId('quiz-feedback')).toContainText('Not quite');
  await page.getByTestId(`quiz-option-${right}`).click();
  await expect(page.getByTestId('quiz-next')).toBeVisible();
}

async function start(page: Page, query = '') {
  await page.goto(`/?debug=1&quality=high${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await expect(page.getByTestId('where-button')).toBeVisible();
}

test('the sound player is not downloaded until the first key, then once', async ({ page }) => {
  const { errors, soundOff, howlerRequests } = watch(page);
  await start(page);
  await page.waitForTimeout(500); // anything the game fetches after its first frame has started by now
  expect(howlerRequests).toEqual([]);

  await page.keyboard.press('KeyX');
  await expect.poll(() => howlerRequests.length).toBe(1);
  await page.keyboard.press('KeyX');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  expect(howlerRequests).toHaveLength(1);
  expect(errors).toEqual([]);
  expect(soundOff).toEqual([]);
});

test('on a touch screen the first tap downloads the sound player and every sound file', async ({ page }) => {
  const { errors, soundOff, howlerRequests, soundRequests } = watch(page);
  await start(page, '&touch=1');
  await page.waitForTimeout(500);
  expect(howlerRequests).toEqual([]);

  const canvas = (await page.locator('#game-canvas canvas').boundingBox())!;
  expect(soundRequests).toEqual([]);
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 3);
  await expect.poll(() => howlerRequests.length).toBe(1);
  await expect.poll(() => soundRequests.length).toBe(SOUND_COUNT);
  expect(errors).toEqual([]);
  expect(soundOff).toEqual([]);
});

test('nothing plays and no sound file is fetched before the first tap or key, even when events fire', async ({ page }) => {
  const { errors, soundOff, soundRequests } = watch(page);
  await start(page);
  await landOnMars(page); // docking fires `arrived`, which has a sound
  await page.waitForTimeout(500);
  expect(soundRequests).toEqual([]);
  expect(await played(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(soundOff).toEqual([]);
});

test('after the first key the sounds load once, and play on docking, finds, answers, stars and boost', async ({ page }) => {
  const { errors, soundOff, soundRequests } = watch(page);
  await start(page);
  await page.keyboard.press('KeyX');
  await expect.poll(() => soundRequests.length).toBe(SOUND_COUNT);
  expect(new Set(soundRequests).size).toBe(SOUND_COUNT); // each file once

  await landOnMars(page);
  expect(await played(page)).toEqual(['docking']);
  await missionAndFirstAnswers(page);
  // The first two finds ding; the third finishes the mission and earns a star, which plays instead.
  expect(await played(page)).toEqual(['docking', 'dot-found', 'dot-found', 'star', 'not-quite', 'right']);

  // Back in space, holding Space boosts: one whoosh when it starts.
  await page.getByTestId('quiz-close').click();
  await page.getByTestId('back-to-space').click();
  await expect(page.getByTestId('where-button')).toBeVisible();
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await played(page)).filter((id) => id === 'boost').length).toBe(1);
  expect(soundRequests).toHaveLength(SOUND_COUNT);
  expect(errors).toEqual([]);
  expect(soundOff).toEqual([]);
});

test('with Sound effects off nothing plays, and Off is remembered', async ({ page }) => {
  const { errors, soundOff } = watch(page);
  await start(page);
  await page.getByTestId('menu-button').click();
  await page.getByTestId('tab-settings').click();
  const effects = page.getByRole('radiogroup', { name: 'Sound effects', exact: true });
  await effects.getByRole('radio', { name: 'Off', exact: true }).click();
  await page.getByTestId('settings-done').click();

  await landOnMars(page);
  await findDot(page, 'rim');
  await page.waitForTimeout(200);
  expect(await played(page)).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { rocketPals: { getSettings(): { volume: { effects: number } } } }).rocketPals.getSettings().volume.effects)).toBe(0);

  await page.reload();
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await page.getByTestId('menu-button').click();
  await page.getByTestId('tab-settings').click();
  await expect(effects.getByRole('radio', { name: 'Off', exact: true })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
  expect(soundOff).toEqual([]);
});

test('with audio blocked the game still plays, with one "Sound is off" warning and no errors', async ({ page }) => {
  const { errors, soundOff } = watch(page, [/Failed to load resource/]);
  await page.route(/\/assets\/howler-[^/]*\.js$/, (route) => route.abort());
  await page.route('**/sounds/**', (route) => route.abort());
  await start(page);
  await page.keyboard.press('KeyX');
  await expect.poll(() => soundOff.length).toBe(1);

  await landOnMars(page);
  await missionAndFirstAnswers(page);
  for (let q = 0; q < 2; q++) {
    await page.getByTestId('quiz-next').click();
    await page.getByTestId(`quiz-option-${await rightIndex(page)}`).click();
  }
  await page.getByTestId('quiz-next').click(); // See my stars
  await expect(page.getByTestId('quiz-stars')).toBeVisible();
  expect(await played(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(soundOff).toHaveLength(1);
});
