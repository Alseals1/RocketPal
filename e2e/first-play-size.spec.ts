import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// "Under 15 MB to first play" (CLAUDE.md, architecture 5.11): everything the page
// downloads before you can fly. Measured as the uncompressed bytes of every
// same-origin response until the network goes quiet, so it is an upper bound
// on the real (compressed) download. The CI job summary shows the result.
//
// "Quiet" is measured here, not with Playwright's 'networkidle': software WebGL
// stalls the page, so the rocket model is often requested after 'networkidle'.
const BUDGET_BYTES = 15_000_000;
const QUIET_MS = 3_000;
const START_PATH = '/?quality=high'; // the worst case: the sharpest textures

test('the first-play download is under the 15 MB budget, and nothing is fetched from another site', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const pending: Promise<void>[] = [];
  const files: { path: string; bytes: number }[] = [];
  const offsite: string[] = [];
  let inFlight = 0;
  let lastActivity = Date.now();
  const settle = () => {
    inFlight--;
    lastActivity = Date.now();
  };
  page.on('request', () => {
    inFlight++;
    lastActivity = Date.now();
  });
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);

  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== origin) {
      offsite.push(response.url());
      return;
    }
    if (response.status() >= 300 && response.status() < 400) return;
    pending.push(
      response.body().then(
        (body) => {
          files.push({ path: url.pathname + url.search, bytes: body.length });
        },
        () => {}, // a body that cannot be read (for example an aborted request) is not a download
      ),
    );
  });

  await page.goto(START_PATH);
  await expect(page.locator('#game-canvas canvas')).toBeAttached();
  await expect
    .poll(() => inFlight === 0 && Date.now() - lastActivity >= QUIET_MS, { timeout: 45_000, intervals: [250] })
    .toBe(true);
  await Promise.all(pending);

  files.sort((a, b) => b.bytes - a.bytes);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  mkdirSync('size-report', { recursive: true });
  writeFileSync(
    'size-report/first-play.json',
    JSON.stringify({ measuredAt: new Date().toISOString(), url: START_PATH, totalBytes, budgetBytes: BUDGET_BYTES, files }, null, 2),
  );

  expect(offsite).toEqual([]);
  expect(files.length).toBeGreaterThan(0);
  expect(totalBytes).toBeLessThan(BUDGET_BYTES);
});
