import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

interface QuizFile {
  quizzes: { worldId: string; questions: { question: string; because: string; options: { text: string; correct: boolean }[] }[] }[];
}
interface MissionFile {
  missions: { worldId: string; title: string; done: string; teaser: string }[];
}
const quizzes = JSON.parse(readFileSync('public/data/quizzes.json', 'utf8')) as QuizFile;
const missions = JSON.parse(readFileSync('public/data/missions.json', 'utf8')) as MissionFile;
const quizOf = (world: string) => quizzes.quizzes.find((q) => q.worldId === world)!.questions;
const missionOf = (world: string) => missions.missions.find((m) => m.worldId === world)!;
const rightIndex = (world: string, q: number) => quizOf(world)[q].options.findIndex((o) => o.correct);
const wrongIndexes = (world: string, q: number) => [0, 1, 2].filter((i) => i !== rightIndex(world, q));

/** The dots found to finish each mission (the first three on each world). */
const DOTS: Record<string, string[]> = { mars: ['rim', 'ground', 'sky'], earth: ['aurora', 'air', 'clouds'] };

interface DebugHandle {
  getMode(): string;
  getLook(): { azimuth: number; elevation: number } | undefined;
  getStars(world: string): number;
  dockAt(id: string): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;
const stars = (page: Page, world: string) =>
  page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.getStars(id), world);

/** A pretend voice that records what it was asked to read. */
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(WORKING_VOICE);
});

function watchForErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !ignore.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function start(page: Page) {
  await page.goto('/?debug=1&quality=high&touch=1');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
}

async function land(page: Page, world: string) {
  await page.evaluate((id) => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt(id), world);
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
}

async function startAndLand(page: Page, world: string) {
  await start(page);
  await land(page, world);
}

/** Opens one dot's card with the keyboard and closes it again. */
async function findDot(page: Page, id: string) {
  const spot = page.getByTestId(`spot-${id}`);
  await spot.focus();
  await expect(spot).toHaveCSS('opacity', '1', { timeout: 5000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fact-card')).toBeVisible();
  await page.getByTestId('close-card').click();
  await expect(page.getByTestId('fact-card')).toBeHidden();
}

async function finishMission(page: Page, world: string) {
  for (const id of DOTS[world]) await findDot(page, id);
  await expect(page.getByTestId('quiz-time')).toBeVisible();
}

/** Answers question `q` right on the first try, then moves on. */
async function answerRight(page: Page, world: string, q: number) {
  await page.getByTestId(`quiz-option-${rightIndex(world, q)}`).click();
  await expect(page.getByTestId('quiz-because')).toHaveText(quizOf(world)[q].because);
  await page.getByTestId('quiz-next').click();
}

async function takeQuizPerfectly(page: Page, world: string) {
  for (let q = 0; q < 3; q++) await answerRight(page, world, q);
}

const starsText = (page: Page) => page.getByTestId('stars').getAttribute('aria-label');

test.describe('the mission', () => {
  test('starts as a goal, finishes on the third find, and Orbit says so', async ({ page }) => {
    const errors = watchForErrors(page);
    await startAndLand(page, 'mars');

    await expect(page.getByTestId('mission')).toHaveText(`Mission: ${missionOf('mars').title}`);
    expect(await starsText(page)).toBe('0 of 3 stars');
    await expect(page.getByTestId('quiz-time')).toBeHidden(); // nothing to quiz on yet

    await findDot(page, 'rim');
    await findDot(page, 'ground');
    await expect(page.getByTestId('quiz-time')).toBeHidden();
    expect(await stars(page, 'mars')).toBe(0);

    await findDot(page, 'sky'); // the third
    await expect(page.getByTestId('orbit')).toHaveText(missionOf('mars').done);
    await expect(page.getByTestId('mission')).toHaveText(`✓ ${missionOf('mars').title}`);
    await expect(page.getByTestId('quiz-time')).toBeVisible();
    expect(await starsText(page)).toBe('1 of 3 stars');
    expect(await stars(page, 'mars')).toBe(1);
    expect(errors).toEqual([]);
  });

  test('on Earth too, and finding the same dot again does not count twice', async ({ page }) => {
    await startAndLand(page, 'earth');
    await findDot(page, 'aurora');
    await findDot(page, 'aurora');
    await findDot(page, 'aurora');
    await expect(page.getByTestId('found')).toHaveText('Found 1 of 6');
    await expect(page.getByTestId('quiz-time')).toBeHidden();
    await findDot(page, 'air');
    await findDot(page, 'clouds');
    await expect(page.getByTestId('orbit')).toHaveText(missionOf('earth').done);
    expect(await stars(page, 'earth')).toBe(1);
  });
});

test.describe('the quiz', () => {
  test('asks three questions; wrong answers never stop anything; the right answer shows why', async ({ page }) => {
    const errors = watchForErrors(page);
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    await expect(page.getByTestId('quiz-card')).toBeVisible();

    for (let q = 0; q < 3; q++) {
      await expect(page.getByTestId('quiz-step')).toHaveText(`Question ${q + 1} of 3`);
      await expect(page.getByTestId('quiz-question')).toHaveText(quizOf('mars')[q].question);
      for (let i = 0; i < 3; i++) await expect(page.getByTestId(`quiz-option-${i}`)).toHaveText(quizOf('mars')[q].options[i].text);
      await expect(page.getByTestId('quiz-next')).toBeHidden();

      if (q === 0) {
        // Try every wrong answer: each one greys out with a word and a mark, nothing ends, the right one still works.
        for (const wrong of wrongIndexes('mars', 0)) {
          const option = page.getByTestId(`quiz-option-${wrong}`);
          await option.click();
          await expect(option).toContainText('not quite');
          await expect(option).toContainText('✗');
          await expect(option).toHaveAttribute('aria-disabled', 'true');
          await expect(page.getByTestId('quiz-feedback')).toHaveText('Not quite. Try another one!');
          await expect(page.getByTestId('quiz-card')).toBeVisible();
          await expect(page.getByTestId('quiz-step')).toHaveText('Question 1 of 3');
        }
      }
      const right = page.getByTestId(`quiz-option-${rightIndex('mars', q)}`);
      await right.click();
      await expect(right).toContainText('✓');
      await expect(page.getByTestId('quiz-feedback')).toHaveText('Yes! That is right!');
      await expect(page.getByTestId('quiz-because')).toHaveText(quizOf('mars')[q].because);
      await expect(page.getByTestId('quiz-next')).toHaveText(q < 2 ? 'Next question' : 'See my stars');
      await page.getByTestId('quiz-next').click();
    }

    // Some answers were wrong on question 1, so it is not perfect: mission star + finished star = 2.
    await expect(page.getByTestId('quiz-question')).toHaveText('Quiz done!');
    await expect(page.getByTestId('quiz-stars')).toHaveAttribute('aria-label', '2 of 3 stars');
    await expect(page.getByTestId('quiz-teaser')).toHaveText(missionOf('mars').teaser);
    await expect(page.getByTestId('quiz-feedback')).toContainText('bonus star');
    expect(await starsText(page)).toBe('2 of 3 stars');
    expect(await stars(page, 'mars')).toBe(2);
    expect(errors).toEqual([]);
  });

  test('three right on the first try earns the bonus star, on a replay too, and stars never go back down', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');

    // First go: a slip on question 2.
    await page.getByTestId('quiz-time').click();
    await answerRight(page, 'mars', 0);
    await page.getByTestId(`quiz-option-${wrongIndexes('mars', 1)[0]}`).click();
    await answerRight(page, 'mars', 1);
    await answerRight(page, 'mars', 2);
    await expect(page.getByTestId('quiz-stars')).toHaveAttribute('aria-label', '2 of 3 stars');

    // Replay perfectly: the bonus arrives.
    await page.getByTestId('quiz-again').click();
    await expect(page.getByTestId('quiz-step')).toHaveText('Question 1 of 3');
    await takeQuizPerfectly(page, 'mars');
    await expect(page.getByTestId('quiz-question')).toHaveText('Quiz done! Perfect!');
    await expect(page.getByTestId('quiz-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    await expect(page.getByTestId('quiz-feedback')).toHaveText('All three right on the first try! You earned the bonus star!');
    expect(await stars(page, 'mars')).toBe(3);

    // Replay badly: nothing is taken away.
    await page.getByTestId('quiz-again').click();
    await page.getByTestId(`quiz-option-${wrongIndexes('mars', 0)[0]}`).click();
    await answerRight(page, 'mars', 0);
    await answerRight(page, 'mars', 1);
    await answerRight(page, 'mars', 2);
    await expect(page.getByTestId('quiz-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    await expect(page.getByTestId('quiz-feedback')).toHaveText('You have all 3 stars on this world!');
    expect(await stars(page, 'mars')).toBe(3);
  });

  test('works with the keyboard alone, on Earth', async ({ page }) => {
    const errors = watchForErrors(page);
    await startAndLand(page, 'earth');
    await finishMission(page, 'earth');

    await page.getByTestId('quiz-time').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quiz-card')).toBeVisible();
    await expect(page.getByTestId('quiz-option-0')).toBeFocused(); // focus starts on the first answer

    for (let q = 0; q < 3; q++) {
      await page.getByTestId(`quiz-option-${rightIndex('earth', q)}`).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('quiz-next')).toBeFocused(); // focus moves to what to do next
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('quiz-question')).toHaveText('Quiz done! Perfect!');
    await expect(page.getByTestId('quiz-again')).toBeFocused();
    expect(await stars(page, 'earth')).toBe(3);
    expect(errors).toEqual([]);
  });

  test('Tab stays inside the card, Escape closes it without saving a finish, and Quiz time opens a fresh one', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quiz-card')).toBeVisible();

    // Tab round the card many times: focus never leaves it.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.quiz-card'))).toBe(true);
    }

    await answerRight(page, 'mars', 0); // part way through
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quiz-card')).toBeHidden();
    expect(await stars(page, 'mars')).toBe(1); // nothing finished, nothing earned
    await expect(page.getByTestId('quiz-time')).toBeFocused(); // opened by keyboard: focus comes back

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quiz-step')).toHaveText('Question 1 of 3'); // starts over
  });

  test('the game\'s own keys wait while the quiz is open', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    const before = await debug(page, (h) => h.getLook()!);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowLeft');
    const after = await debug(page, (h) => h.getLook()!);
    expect(after.azimuth).toBeCloseTo(before.azimuth, 3);
  });

  test('Listen reads the question and answers, then the reason after a right answer', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();

    const spoken = () => page.evaluate(() => (window as unknown as { __utterances: { text: string }[] }).__utterances.map((u) => u.text));
    await page.getByTestId('quiz-listen').click();
    const first = (await spoken()).at(-1)!;
    expect(first).toContain(quizOf('mars')[0].question);
    for (const option of quizOf('mars')[0].options) expect(first).toContain(option.text);

    await page.getByTestId(`quiz-option-${rightIndex('mars', 0)}`).click();
    await page.getByTestId('quiz-listen').click();
    expect((await spoken()).at(-1)).toContain(quizOf('mars')[0].because);
  });

  test('Back to space on the result card leaves, and the quiz is closed when you come back', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    await takeQuizPerfectly(page, 'mars');
    await page.getByTestId('quiz-back').click();
    await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
    await expect(page.getByTestId('quiz-card')).toBeHidden();

    await land(page, 'mars');
    await expect(page.getByTestId('quiz-card')).toBeHidden();
    await expect(page.getByTestId('quiz-time')).toBeVisible(); // the mission is remembered
  });
});

test.describe('remembering', () => {
  test('stars, the finished mission and the Quiz time button are still there after reloading the page', async ({ page }) => {
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    await takeQuizPerfectly(page, 'mars');
    expect(await stars(page, 'mars')).toBe(3);

    await page.reload();
    await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
    expect(await stars(page, 'mars')).toBe(3);
    expect(await stars(page, 'earth')).toBe(0); // worlds are separate
    await land(page, 'mars');
    expect(await starsText(page)).toBe('3 of 3 stars');
    await expect(page.getByTestId('mission')).toHaveText(`✓ ${missionOf('mars').title}`);
    await expect(page.getByTestId('quiz-time')).toBeVisible();
    await expect(page.getByTestId('found')).toHaveText('Found 0 of 5'); // dots start fresh each visit
  });

  test('saves only the yes/no flags, under one key, and nothing else', async ({ page }) => {
    await startAndLand(page, 'earth');
    await finishMission(page, 'earth');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rocketpals.progress')!));
    expect(saved).toEqual({ version: 1, worlds: { earth: { missionDone: true, quizDone: false, perfectQuiz: false } } });
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => k.startsWith('rocketpals.'))).toEqual(['rocketpals.progress']);
  });

  test('the Quiz time button is not drawn over the loading screen', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('rocketpals.progress', JSON.stringify({ version: 1, worlds: { mars: { missionDone: true, quizDone: true, perfectQuiz: false } } })),
    );
    await page.route('**/textures/surfaces/*.jpg', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await start(page);
    await page.evaluate(() => (window as unknown as { rocketPals: DebugHandle }).rocketPals.dockAt('mars'));
    await expect(page.locator('.surface-loading')).toBeVisible();
    await expect(page.getByTestId('quiz-time')).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId('quiz-time')).toBeVisible();
    expect(await starsText(page)).toBe('2 of 3 stars');
  });

  test('garbage in the saved progress starts fresh, with no errors', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => localStorage.setItem('rocketpals.progress', '{"worlds": {"mars": 5, "earth": {"missionDone": "yes"}}, "x": ['));
    await startAndLand(page, 'mars');
    expect(await starsText(page)).toBe('0 of 3 stars');
    await expect(page.getByTestId('quiz-time')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('if the browser will not store anything, the whole mission and quiz still work for the visit', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage is blocked');
        },
      });
    });
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    await takeQuizPerfectly(page, 'mars');
    await expect(page.getByTestId('quiz-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    expect(await stars(page, 'mars')).toBe(3);
    expect(errors).toEqual([]);
  });
});

test.describe('nothing leaves the computer', () => {
  test('a whole mission and quiz make no request except for the game\'s own files, and send no data', async ({ page }) => {
    const requests: { url: string; method: string; body: string | null }[] = [];
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
    await startAndLand(page, 'mars');
    await finishMission(page, 'mars');
    await page.getByTestId('quiz-time').click();
    await takeQuizPerfectly(page, 'mars');

    const origin = new URL(page.url()).origin;
    for (const r of requests) {
      expect(r.url.startsWith(origin) || r.url.startsWith('data:') || r.url.startsWith('blob:'), r.url).toBe(true);
      expect(r.method, r.url).toBe('GET');
      expect(r.body, r.url).toBeNull();
    }
  });
});

test.describe('when the data is missing', () => {
  test('landing still works with no mission line, no stars and no quiz button', async ({ page }) => {
    // The browser reports each blocked file as a console error by itself; the game logs its own too.
    const errors = watchForErrors(page, [/Failed to load resource/, /Failed to fetch|Could not load|Bad (quiz|mission) data|net::ERR/]);
    await page.route('**/data/missions.json', (route) => route.abort());
    await page.route('**/data/quizzes.json', (route) => route.abort());
    await startAndLand(page, 'mars');
    await expect(page.getByTestId('mission')).toBeHidden();
    await expect(page.getByTestId('quiz-time')).toBeHidden();
    await expect(page.locator('.stats-row').getByText('Stars:')).toBeHidden();
    await findDot(page, 'rim'); // the rest of the landing works as before
    await expect(page.getByTestId('found')).toHaveText('Found 1 of 5');
    expect(errors).toEqual([]);
  });

  test('a quiz file with a broken question is not used (and the game carries on)', async ({ page }) => {
    const errors = watchForErrors(page, [/Bad quiz data|Failed to load/]);
    await page.route('**/data/quizzes.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"lastChecked":"2026-10-23","quizzes":[{"worldId":"mars","questions":[]}]}' }),
    );
    await startAndLand(page, 'mars');
    await expect(page.getByTestId('quiz-time')).toBeHidden();
    await expect(page.getByTestId('orbit')).toContainText("I'm Orbit");
    expect(errors).toEqual([]);
  });
});

test.describe('on small screens with the biggest text', () => {
  const sizes = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ];
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const size of sizes) {
    test(`the quiz card fits or scrolls, and every button is a big target at ${size.width}x${size.height}`, async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
      );
      await page.setViewportSize(size);
      await startAndLand(page, 'earth');
      await finishMission(page, 'earth');
      await page.getByTestId('quiz-time').click();

      const targetsOk = async (selector: string) => {
        for (const box of await page.locator(selector).evaluateAll((els) =>
          els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => {
            const r = e.getBoundingClientRect();
            return { height: r.height, width: r.width, text: e.textContent };
          }),
        )) {
          expect(box.height, `${box.text} is at least 56 px tall`).toBeGreaterThanOrEqual(55);
          expect(box.width, `${box.text} is at least 56 px wide`).toBeGreaterThanOrEqual(55);
        }
      };
      await targetsOk('.quiz-card button');
      // No sideways scrolling, and the card scrolls inside the screen rather than running off it.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const card = (await page.locator('.quiz-card').boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(size.width + 1);

      // Every answer can be reached (scrolled into view) and used.
      for (let q = 0; q < 3; q++) {
        const option = page.getByTestId(`quiz-option-${rightIndex('earth', q)}`);
        await option.scrollIntoViewIfNeeded();
        await option.click();
        const next = page.getByTestId('quiz-next');
        await next.scrollIntoViewIfNeeded();
        await next.click();
      }
      await expect(page.getByTestId('quiz-stars')).toBeVisible();
      await targetsOk('.quiz-card button');
      await page.getByTestId('quiz-close').scrollIntoViewIfNeeded();
      await page.getByTestId('quiz-close').click();
      await expect(page.getByTestId('quiz-card')).toBeHidden();
    });
  }

  for (const size of [
    { width: 420, height: 900 },
    { width: 844, height: 390 },
  ]) {
    test(`the mission line, stars and Quiz time button sit clear of everything else at ${size.width}x${size.height}`, async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem('rocketpals.settings', JSON.stringify({ version: 1, textSize: 'huge', reducedMotion: 'system' })),
      );
      await page.setViewportSize(size);
      for (const world of ['mars', 'earth']) {
        await startAndLand(page, world);
        await finishMission(page, world);
        const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
        const title = await box('.surface-title');
        const quiz = await box('[data-testid="quiz-time"]');
        const back = await box('[data-testid="back-to-space"]');
        const gear = await box('[data-testid="settings-button"]');
        const orbit = await box('.orbit');
        expect(overlaps(title, orbit), `${world}: title over Orbit`).toBe(false);
        expect(overlaps(title, back), `${world}: title over Back`).toBe(false);
        expect(overlaps(title, gear), `${world}: title over settings`).toBe(false);
        expect(overlaps(quiz, title), `${world}: Quiz time over the title card`).toBe(false);
        expect(overlaps(quiz, back), `${world}: Quiz time over Back`).toBe(false);
        expect(overlaps(quiz, gear), `${world}: Quiz time over settings`).toBe(false);
        expect(quiz.x).toBeGreaterThanOrEqual(0);
        expect(quiz.x + quiz.width).toBeLessThanOrEqual(size.width);
        expect(quiz.y + quiz.height).toBeLessThanOrEqual(size.height);
        expect(quiz.height).toBeGreaterThanOrEqual(55);
        await page.evaluate(() => localStorage.clear());
      }
    });
  }
});
