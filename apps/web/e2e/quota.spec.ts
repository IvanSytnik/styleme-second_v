/**
 * Quota gate: 3 free generations succeed, the 4th surfaces QUOTA_EXCEEDED.
 *
 * Isolation: each Playwright context starts with empty storage → Supabase
 * anonymous sign-in mints a FRESH user → quota counters start clean even
 * against persistent Redis. (Locally the api also runs in-memory.)
 */
import { expect, test } from '@playwright/test';

import { expectResult, generateFirstPreset, uploadFixturePhoto } from './helpers';

test('fourth generation is blocked with QUOTA_EXCEEDED', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await uploadFixturePhoto(page);

  for (let i = 0; i < 3; i += 1) {
    await generateFirstPreset(page);
    await expectResult(page);
    await page.getByRole('button', { name: 'Try another style' }).click();
    await expect(page.getByRole('button', { name: 'Generate ✨' })).toBeVisible();
  }

  // Free pool exhausted → header shows 0/3.
  await expect(page.getByText('0/3')).toBeVisible();

  await generateFirstPreset(page);
  // Error surfaces as a sonner toast built from errors.QUOTA_EXCEEDED.
  await expect(page.getByText('No credits left')).toBeVisible({ timeout: 30_000 });
});
