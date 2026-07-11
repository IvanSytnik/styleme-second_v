/**
 * Happy path: / (en) → upload fixture → pick preset → processing → result.
 * The api runs with REPLICATE_MOCK=1: the model call is canned, everything
 * else (anonymous Supabase auth, rate limit, quota consume) is real.
 */
import { expect, test } from '@playwright/test';

import { expectResult, generateFirstPreset, uploadFixturePhoto } from './helpers';

test('upload → preset → result', async ({ page }) => {
  await page.goto('/');

  // Upload screen (en, served at bare / via middleware + as-needed prefix).
  await expect(page.getByRole('heading', { level: 1 })).toContainText('hairstyle');

  await uploadFixturePhoto(page);
  await generateFirstPreset(page);

  // Processing screen must actually render (mock adds ~300ms latency).
  await expect(page.getByText('Creating your new look')).toBeVisible();

  await expectResult(page);

  // Balance in the header reflects the consumed credit (3 free → 2 left).
  await expect(page.getByText('2/3')).toBeVisible();
});
