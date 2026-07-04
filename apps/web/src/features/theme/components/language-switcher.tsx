'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

import { routing, type AppLocale } from '@/i18n/routing';

import styles from './language-switcher.module.css';

/**
 * Language switcher (Day 7, hotfix v2).
 *
 * BUG FOUND (post-delivery, confirmed against next-intl docs): the
 * middleware only SYNCS the `NEXT_LOCALE` cookie when the requested URL
 * contains an EXPLICIT locale prefix. v1 of this component computed a
 * bare `/` target when switching TO the default locale (`en`), which
 * never gave the middleware a prefixed URL to sync the cookie from --
 * so the cookie stayed stuck on whatever locale was visited last, and
 * kept silently overriding `defaultLocale` on every subsequent visit
 * to `/` (documented next-intl behavior: `/ -> /de` if a stale cookie
 * says `de`, regardless of Accept-Language or defaultLocale).
 *
 * Fix: ALWAYS navigate through the explicit `/${locale}` prefix, even
 * for the default locale. The middleware then strips the prefix per
 * `localePrefix: 'as-needed'` (redirecting `/en` -> `/`) and updates
 * the cookie in the same round trip -- this is the exact mechanism
 * next-intl's own `<Link locale="...">` relies on internally. We still
 * don't adopt the full next-intl navigation API here (no screen-level
 * routing exists yet in this app -- see the original YAGNI note this
 * component shipped with), but this detail specifically needed fixing.
 */
export function LanguageSwitcher(): React.ReactElement {
  const t = useTranslations('header');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: AppLocale): void {
    // Strip any current locale prefix from the pathname first, so we
    // build a clean explicit-prefix target regardless of which locale
    // (default or not) we're switching FROM.
    const withoutLocale =
      routing.locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
        ? pathname.replace(new RegExp(`^/${locale}`), '') || '/'
        : pathname;

    // Always request the EXPLICIT prefix, even for defaultLocale — this
    // is what lets the middleware sync the NEXT_LOCALE cookie. The
    // middleware itself will redirect `/en` -> `/` afterward per
    // `localePrefix: 'as-needed'`.
    const target = `/${nextLocale}${withoutLocale === '/' ? '' : withoutLocale}`;

    startTransition(() => {
      router.replace(target);
    });
  }

  return (
    <select
      className={styles.select}
      value={locale}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value as AppLocale)}
      aria-label={t('languageSwitcherAriaLabel')}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {t(`languageNames.${l}`)}
        </option>
      ))}
    </select>
  );
}
