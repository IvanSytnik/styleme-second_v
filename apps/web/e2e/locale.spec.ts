/**
 * Locale routing invariants for localePrefix: 'as-needed' + middleware:
 *   /        → English UI, no redirect
 *   /ru      → Russian UI (html[lang=ru])
 *   /en      → canonicalized to /
 */
import { expect, test } from '@playwright/test';

test('/ serves English at the bare path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Try a new');
});

test('/ru serves Russian', async ({ page }) => {
  await page.goto('/ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page).toHaveURL(/\/ru$/);
});

test('/en canonicalizes to /', async ({ page }) => {
  await page.goto('/en');
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('/de and /uk render their locales', async ({ page }) => {
  await page.goto('/de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goto('/uk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
});
