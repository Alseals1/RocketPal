import type { Page } from '@playwright/test';

/**
 * Waits until both self-hosted fonts (Lexend and Fredoka) have loaded, so layout measurements see
 * the final text widths, not the fallback font's (the fonts use `font-display: swap`).
 */
export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('400 1em Lexend'), document.fonts.load('600 1em Fredoka')]);
    await document.fonts.ready;
  });
}
