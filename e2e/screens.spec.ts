import { test, expect, type Page } from '@playwright/test';

/**
 * Each screen frees what it used when you leave it (#32): the event listeners it added and the picture and shape it
 * gave the graphics card. After a visit and Back to space, the listeners are back where they were before landing, and
 * the graphics card holds one picture and one shape fewer than during the visit.
 */

interface DebugHandle {
  getMode(): string;
  hasShipModel(): boolean;
  hasPanorama(): boolean;
  getRenderMemory(): { textures: number; geometries: number };
  getHeldAssets(): string[];
  dockAt(id: string): void;
}
const debug = <T>(page: Page, fn: (h: DebugHandle) => T) => page.evaluate(`(${fn.toString()})(window.rocketPals)`) as Promise<T>;

/**
 * Keeps a list of every event listener that is still listening, so the test can compare before and after.
 * A listener on a page element counts only while the element is on the page (a removed element cannot hear anything).
 * `once` listeners are left out: the browser removes them by itself when they fire.
 */
const TRACK_LISTENERS = `
  (() => {
    const live = new Map();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    const keyOf = (type, options) => type + '|' + (typeof options === 'boolean' ? options : Boolean(options && options.capture));
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      add.call(this, type, listener, options);
      if (!listener || (options && typeof options === 'object' && (options.once || options.signal))) return;
      let byType = live.get(this);
      if (!byType) live.set(this, (byType = new Map()));
      const key = keyOf(type, options);
      if (!byType.has(key)) byType.set(key, new Set());
      byType.get(key).add(listener);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      remove.call(this, type, listener, options);
      live.get(this)?.get(keyOf(type, options))?.delete(listener);
    };
    const nameOf = (target) => {
      if (target === window) return 'window';
      if (target === document) return 'document';
      if (target instanceof Element) return target.tagName.toLowerCase() + (target.classList[0] ? '.' + target.classList[0] : '');
      return target.constructor.name;
    };
    window.__liveListeners = () => {
      const out = [];
      for (const [target, byType] of live) {
        if (target instanceof Node && !target.isConnected) continue;
        for (const [key, listeners] of byType) for (let i = 0; i < listeners.size; i++) out.push(nameOf(target) + ':' + key.split('|')[0]);
      }
      return out.sort();
    };
  })();`;

/** The debug handle's members before #32, plus `getRenderMemory` and `getHeldAssets` (#40). Nothing is taken away or renamed. */
const DEBUG_MEMBERS = [
  'dockAt',
  'getFound',
  'getFps',
  'getHeldAssets',
  'getLook',
  'getMode',
  'getQuality',
  'getRenderMemory',
  'getSettings',
  'getShip',
  'getStars',
  'getTargetId',
  'getViewFov',
  'getWorld',
  'hasPanorama',
  'hasShipModel',
  'isGlowVisible',
  'isLookTurning',
  'isReducedMotion',
  'pickTarget',
  'setAutopilot',
  'setBackdrop',
];

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Waits for some frames to be drawn, so the graphics card has everything the view needs. */
const frames = (page: Page, count: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    count,
  );

async function snapshot(page: Page): Promise<{ listeners: string[] }> {
  await frames(page, 30);
  return { listeners: await page.evaluate(() => (window as unknown as { __liveListeners(): string[] }).__liveListeners()) };
}

async function start(page: Page) {
  await page.addInitScript(TRACK_LISTENERS);
  await page.goto('/?debug=1&quality=high');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  await expect.poll(() => debug(page, (h) => h.hasShipModel()), { timeout: 20_000 }).toBe(true);
}

/**
 * Lands on a world, then goes Back to space, and returns the graphics memory just before and just after Back.
 *
 * Both are read in the same task as the click, so no frame is drawn in between. That matters: once the rocket lifts off
 * somewhere new, space shows planets that were off screen before, and Three.js puts them on the card the first time it
 * draws them. That growth belongs to space, not to the visit, so the memory before landing is no fair comparison.
 */
async function visit(page: Page, worldId: string) {
  await page.evaluate(`window.rocketPals.dockAt(${JSON.stringify(worldId)})`);
  await expect(page.locator('.surface-loading')).toBeHidden({ timeout: 20_000 });
  await frames(page, 5);
  const result = await page.evaluate(async () => {
    const h = (window as unknown as { rocketPals: DebugHandle }).rocketPals;
    const during = h.getRenderMemory();
    const heldDuring = h.getHeldAssets();
    document.querySelector<HTMLButtonElement>('[data-testid="back-to-space"]')!.click();
    for (let i = 0; i < 20; i++) await Promise.resolve(); // leaving finishes in a few promise steps, before any frame
    return { during, left: h.getRenderMemory(), heldDuring, heldAfter: h.getHeldAssets(), mode: h.getMode() };
  });
  expect(result.mode).toBe('space');
  return result;
}

test('leaving a world frees its listeners, its picture and its shape (Mars, Earth, Mars again)', async ({ page }) => {
  const errors = watchForErrors(page);
  await start(page);
  const before = await snapshot(page);
  expect(before.listeners.length).toBeGreaterThan(0);

  for (const world of ['mars', 'earth', 'mars']) {
    const { during, left, heldDuring, heldAfter } = await visit(page, world);
    // A visit puts exactly one picture and one shape (the sphere, or the flat window photo) on the graphics card.
    expect(left, `graphics memory after leaving ${world}`).toEqual({ textures: during.textures - 1, geometries: during.geometries - 1 });
    // The visit holds its photo through the asset manager, and lets go of it on Back. The rocket is held for the run.
    expect(heldDuring, `assets held on ${world}`).toEqual(['model/ship', `photo/${world}`]);
    expect(heldAfter, `assets held after leaving ${world}`).toEqual(['model/ship']);
    const after = await snapshot(page);
    expect(after.listeners, `listeners after leaving ${world}`).toEqual(before.listeners);
  }
  expect(errors).toEqual([]);
});

test('Back while the picture is still loading frees everything too, even when the picture arrives late', async ({ page }) => {
  const errors = watchForErrors(page);
  await page.route('**/textures/surfaces/*.jpg', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await start(page);
  const before = await snapshot(page);

  await debug(page, (h) => h.dockAt('mars'));
  await expect(page.locator('.surface-loading')).toBeVisible();
  await page.getByTestId('back-to-space').click();
  await expect.poll(() => debug(page, (h) => h.getMode())).toBe('space');
  await page.waitForTimeout(2500); // the picture arrives now, after the player has left

  // The late picture is thrown away before it is ever drawn, so it never reaches the graphics card.
  expect(await debug(page, (h) => h.hasPanorama())).toBe(false);
  expect(await debug(page, (h) => h.getHeldAssets())).toEqual(['model/ship']); // the late picture was released at once
  const after = await snapshot(page);
  expect(after.listeners).toEqual(before.listeners);
  expect(errors).toEqual([]);
});

test('the debug handle keeps every member it had, and adds getRenderMemory and getHeldAssets', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => (window as unknown as { rocketPals?: unknown }).rocketPals !== undefined);
  const keys = await page.evaluate(() => Object.keys((window as unknown as { rocketPals: object }).rocketPals).sort());
  expect(keys).toEqual(DEBUG_MEMBERS);
});
