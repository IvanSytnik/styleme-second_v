/**
 * next-intl routing config (Day 7, ADR-010 / D1).
 *
 * localePrefix: 'as-needed' — the defaultLocale (en) has NO url prefix
 * (`/`), all other locales are prefixed (`/de`, `/uk`, `/ru`). This keeps
 * existing/shared links to `/` working as English while giving every
 * other locale a real, shareable, SEO-indexable URL.
 */
import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'de', 'uk', 'ru'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
