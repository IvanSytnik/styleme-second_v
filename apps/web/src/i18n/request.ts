/**
 * next-intl server-side request config (Day 7).
 *
 * Resolves the active locale (validated against `routing.locales`) and
 * loads the matching JSON message catalog. Falls back to defaultLocale
 * if an invalid/unknown locale segment somehow reaches here (middleware
 * should prevent this, but this is the load-bearing safety net).
 */
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
