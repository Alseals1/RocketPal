import { test, expect, type Page } from '@playwright/test';
import { fontsReady } from './fonts.ts';

// The component test page (docs/VISUAL_DESIGN.md section 6). Built only for the browser tests (RP_GALLERY=1).
const GALLERY = '/gallery/components.html';

const SIZES = [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
];
const SCALES = ['1', '1.25', '1.5'];
const CYAN = 'rgb(123, 223, 242)';

function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function openGallery(page: Page, query = '') {
  await page.goto(`${GALLERY}${query}`);
  await expect(page.locator('[data-component]').first()).toBeVisible();
  await fontsReady(page);
}

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

/** Every visible pressable part on the page, with its box. */
const pressables = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.rp-pressable')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        const id = el.dataset.testid ?? `${el.className.split(' ')[0]}#${i}:${el.textContent?.trim().slice(0, 20)}`;
        return { id, x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height, primary: el.classList.contains('rp-button--primary') };
      }),
  ) as Promise<Box[]>;

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

test.describe('every component fits at every size and text size', () => {
  for (const size of SIZES) {
    for (const scale of SCALES) {
      test(`${size.width}x${size.height} at text scale ${scale}`, async ({ page }) => {
        const errors = watchForErrors(page);
        await page.setViewportSize(size);
        await openGallery(page, `?scale=${scale}`);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, 'no sideways scrolling').toBeLessThanOrEqual(size.width);

        const boxes = await pressables(page);
        expect(boxes.length).toBeGreaterThan(5);
        for (const box of boxes) {
          expect(box.height, `${box.id} height`).toBeGreaterThanOrEqual(box.primary ? 64 : 56);
          expect(box.width, `${box.id} width`).toBeGreaterThanOrEqual(56);
          expect(box.x, `${box.id} inside the screen`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${box.id} inside the screen`).toBeLessThanOrEqual(size.width + 0.5);
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(overlaps(boxes[i], boxes[j]), `${boxes[i].id} overlaps ${boxes[j].id}`).toBe(false);
          }
        }
        expect(errors).toEqual([]);
      });
    }
  }
});

test('every pressable part has a name a screen reader can read', async ({ page }) => {
  await openGallery(page);
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.rp-pressable')].filter((el) => !(el.getAttribute('aria-label') || el.textContent?.trim())).map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(unnamed).toEqual([]);
  await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
});

test.describe('keyboard', () => {
  test('Tab reaches every pressable part in order, with the cyan focus ring', async ({ page }) => {
    const errors = watchForErrors(page);
    await openGallery(page);
    // One Tab stop per enabled button, and one for the segmented control (its checked option).
    const expected = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.rp-pressable')].filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled).length,
    );
    const reached = new Set<string>();
    for (let i = 0; i < expected; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const style = getComputedStyle(el);
        const gap = getComputedStyle(el, '::before');
        return { key: el.dataset.testid ?? el.textContent?.trim() ?? '', pressable: el.classList.contains('rp-pressable'), width: style.outlineWidth, color: style.outlineColor, style: style.outlineStyle, gap: gap.opacity };
      });
      expect(ring.pressable, `stop ${i} is a component`).toBe(true);
      expect(ring.width).toBe('3px');
      expect(ring.style).toBe('solid');
      expect(ring.color).toBe(CYAN);
      expect(ring.gap, 'the dark gap shows').toBe('1');
      reached.add(ring.key);
    }
    expect(reached.size).toBe(expected);
    expect(errors).toEqual([]);
  });

  test('the segmented control moves with the arrows, Home and End', async ({ page }) => {
    await openGallery(page);
    const checked = page.getByTestId('segmented').locator('[aria-checked="true"]');
    await page.getByRole('radio', { name: 'Normal', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(checked).toHaveText('Big');
    await expect(page.getByRole('radio', { name: 'Big', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(checked).toHaveText('Extra big');
    await page.keyboard.press('ArrowRight'); // wraps round
    await expect(checked).toHaveText('Normal');
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    await expect(checked).toHaveText('Normal');
    await expect(page.getByTestId('segmented-value')).toHaveText('normal');
    // Only the checked option is a Tab stop.
    const stops = await page.getByTestId('segmented').locator('[role="radio"]').evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex));
    expect(stops).toEqual([0, -1, -1]);
    // The thumb moves by transform only.
    await page.keyboard.press('End');
    const transform = await page.locator('.rp-segmented__thumb').evaluate((el) => getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
  });

  test('the dialog keeps Tab inside, Escape closes it, and focus goes back to the opener', async ({ page }) => {
    const errors = watchForErrors(page);
    await openGallery(page);
    const opener = page.getByTestId('dialog-open');
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'The edge of Jezero Crater' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.locator('h2')).toBeFocused();

    const inside = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside()).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    // An action that closes it also gives focus back.
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Listen' }).click();
    await expect(page.getByTestId('dialog-result')).toHaveText('listen');
    await expect(dialog).toBeVisible(); // Listen keeps the card open
    await dialog.getByRole('button', { name: 'Got it' }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('taps choose a segment and press dialog actions', async ({ page }) => {
    const errors = watchForErrors(page);
    await openGallery(page);
    await page.getByRole('radio', { name: 'Big', exact: true }).tap();
    await expect(page.getByRole('radio', { name: 'Big', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('segmented-value')).toHaveText('big');

    await page.getByTestId('dialog-open').tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Got it' }).tap();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('dialog-result')).toHaveText('got it');
    expect(errors).toEqual([]);
  });
});

test('high quality blurs the glass; low quality has no blur and the strong fill', async ({ page }) => {
  const glass = (id: string) =>
    page.getByTestId(id).evaluate((el) => {
      const s = getComputedStyle(el);
      return { blur: s.backdropFilter, fill: s.backgroundColor };
    });

  await openGallery(page, '?quality=high');
  expect((await glass('glass-card-white')).blur).toBe('blur(16px)');
  expect((await glass('glass-card-white')).fill).toBe('rgba(11, 16, 48, 0.75)');
  expect((await glass('glass-hud-white')).fill).toBe('rgba(11, 16, 48, 0.75)');
  expect((await glass('glass-dialog-white')).fill).toBe('rgba(11, 16, 48, 0.86)');

  await openGallery(page, '?quality=low');
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'low');
  for (const id of ['glass-hud-white', 'glass-card-white', 'glass-sheet-space', 'glass-dialog-space']) {
    expect(await glass(id), id).toEqual({ blur: 'none', fill: 'rgba(11, 16, 48, 0.86)' });
  }
});

test('reduced motion: nothing in a component moves or fades', async ({ page }) => {
  await openGallery(page, '?motion=reduced');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByTestId('dialog-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('toast-push').evaluate((el) => (el as HTMLElement).click()); // under the scrim: press it directly

  const moving = await page.evaluate(() => {
    const out: string[] = [];
    const nonZero = (list: string) => list.split(',').some((d) => parseFloat(d) > 0);
    for (const el of document.querySelectorAll<HTMLElement>('[class*="rp-"]')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        if (nonZero(s.transitionDuration) || (s.animationName !== 'none' && nonZero(s.animationDuration))) out.push(`${el.className}${pseudo ?? ''}`);
      }
    }
    return out;
  });
  expect(moving).toEqual([]);
  // The dialog is in its final state straight away.
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
});

test('with motion, only transform and opacity are ever transitioned', async ({ page }) => {
  await openGallery(page);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[class*="rp-"]')) {
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        const props = s.transitionProperty.split(',').map((p) => p.trim());
        const durations = s.transitionDuration.split(',').map((d) => parseFloat(d));
        props.forEach((p, i) => {
          if ((durations[i % durations.length] ?? 0) > 0 && p !== 'transform' && p !== 'opacity') out.push(`${el.className}${pseudo ?? ''}: ${p}`);
        });
        if (s.animationName !== 'none') {
          // Keyframes are checked in tests/styles.test.ts; here only that they exist on purpose.
          if (!/rp-/.test(s.animationName)) out.push(`${el.className}${pseudo ?? ''}: animation ${s.animationName}`);
        }
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('a toast is read politely, shows for 2.5 seconds, then goes', async ({ page }) => {
  const errors = watchForErrors(page);
  await openGallery(page);
  const region = page.getByTestId('toast-region');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await page.getByTestId('toast-push').click();
  const toast = region.locator('.rp-toast');
  await expect(toast).toHaveText('+3 XP Capsule fact');
  await expect(toast).toBeVisible();
  const shown = Date.now();
  await page.waitForTimeout(2000);
  await expect(toast).toHaveText('+3 XP Capsule fact');
  await expect(toast).toHaveText('', { timeout: 3000 });
  expect(Date.now() - shown).toBeGreaterThanOrEqual(2300);
  await expect(toast).toBeHidden();
  expect(errors).toEqual([]);
});

test('the game build does not link to the test page', async ({ page }) => {
  await page.goto('/?debug=1&quality=low');
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href], link[href], script[src]')].map((el) => el.getAttribute('href') ?? el.getAttribute('src')));
  expect(links.some((l) => l?.includes('gallery'))).toBe(false);
});
