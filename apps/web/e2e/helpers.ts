import path from 'node:path';

import { expect, type Page } from '@playwright/test';

export const FIXTURE_PHOTO = path.join(__dirname, 'fixtures', 'test-face.jpg');

/**
 * Upload the fixture photo via the hidden file input (the visible dropzone
 * just proxies clicks to it) and land on the catalog screen.
 */
export async function uploadFixturePhoto(page: Page): Promise<void> {
  // The upload screen has two hidden inputs; the picker one accepts the
  // explicit jpeg/png/webp list, the camera one accepts image/*.
  const input = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]');
  await input.setInputFiles(FIXTURE_PHOTO);
  // Catalog mode selector appears once the store transitions.
  await expect(page.getByRole('button', { name: 'Generate ✨' })).toBeVisible();
}

/**
 * Pick the first preset in the gallery and generate. Selector strategy:
 * presets are exposed with accessible names from i18n (e.g. "Classic Bob").
 *
 * Hotfix: the gallery renders custom `<button role="radio">` cards, not
 * native <input type="radio">. Playwright's `.check()` enforces native
 * checkbox/radio state-verification semantics that don't reliably apply
 * to custom ARIA widgets — it intermittently reported "did not change
 * state" even though the click handler fired. Plain `.click()` is the
 * correct action here.
 */
export async function generateFirstPreset(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Classic Bob' }).first().click();
  await page.getByRole('button', { name: 'Generate ✨' }).click();
}

/** Wait through processing to the result screen. */
export async function expectResult(page: Page): Promise<void> {
  // exact: true — critical: default role-name matching is SUBSTRING,
  // and the processing heading "Creating your new look" contains
  // "Your new look", which made this assert pass on the WRONG screen.
  await expect(
    page.getByRole('heading', { name: 'Your new look', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Before', { exact: true })).toBeVisible();
  await expect(page.getByText('After', { exact: true })).toBeVisible();
}