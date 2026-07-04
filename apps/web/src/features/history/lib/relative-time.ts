/**
 * Minimal relative-time helper. No external dep (Intl.RelativeTimeFormat
 * is native ES2020, present everywhere we support).
 *
 * Kept in feature/history/lib because Day 5 is the only current consumer.
 * If a second consumer appears, promote to /lib.
 *
 * Day 7: takes `locale` as a parameter instead of hardcoding 'en'. This
 * is a plain function (not a hook) so the caller supplies the active
 * locale, typically via `useLocale()` from next-intl.
 */

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = DAY * 7;
const MONTH = DAY * 30;

export function relativeTime(iso: string, locale: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  const rtf =
    typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
      ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
      : null;

  if (!rtf) {
    // Very defensive fallback — modern browsers all have RelativeTimeFormat.
    return new Date(iso).toLocaleDateString(locale);
  }

  if (abs < MINUTE) return rtf.format(Math.round(seconds), 'second');
  if (abs < HOUR) return rtf.format(Math.round(seconds / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(seconds / HOUR), 'hour');
  if (abs < WEEK) return rtf.format(Math.round(seconds / DAY), 'day');
  if (abs < MONTH) return rtf.format(Math.round(seconds / WEEK), 'week');
  return rtf.format(Math.round(seconds / MONTH), 'month');
}
