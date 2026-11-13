import { test, expect, type Page } from '@playwright/test';

/** The sound player (Howler) is its own file, fetched only after the first key or tap (#41). */
const isHowlerChunk = (url: string) => /\/assets\/howler-[^/]*\.js$/.test(url);

function watch(page: Page) {
  const errors: string[] = [];
  const howlerRequests: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('request', (request) => {
    if (isHowlerChunk(request.url())) howlerRequests.push(request.url());
  });
  return { errors, howlerRequests };
}

async function start(page: Page, query = '') {
  await page.goto(`/?debug=1&quality=high${query}`);
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await expect(page.getByTestId('where-button')).toBeVisible();
}

test('the sound player is not downloaded until the first key, then once', async ({ page }) => {
  const { errors, howlerRequests } = watch(page);
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
});

test('on a touch screen the first tap downloads the sound player', async ({ page }) => {
  const { errors, howlerRequests } = watch(page);
  await start(page, '&touch=1');
  await page.waitForTimeout(500);
  expect(howlerRequests).toEqual([]);

  const canvas = (await page.locator('#game-canvas canvas').boundingBox())!;
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 3);
  await expect.poll(() => howlerRequests.length).toBe(1);
  expect(errors).toEqual([]);
});
