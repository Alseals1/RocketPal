import { expect, type Page } from '@playwright/test';

/** Opens the Star Map with its button and waits until it shows. */
export async function openStarMap(page: Page): Promise<void> {
  await page.getByTestId('star-map-button').click();
  await expect(page.getByTestId('star-map')).toBeVisible();
}

/** Sets course to a world the way a player does: Star Map, tap the world, then Set course. The map closes. */
export async function pickWorld(page: Page, id: string): Promise<void> {
  await openStarMap(page);
  await page.getByTestId(`star-map-node-${id}`).click();
  await page.getByTestId('set-course').click();
  await expect(page.getByTestId('star-map')).toBeHidden();
}
