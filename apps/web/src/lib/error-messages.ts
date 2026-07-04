/**
 * Maps stable API error codes to user-facing messages.
 *
 * Day 7 (ADR-010): titles/bodies now come from the i18n dictionary
 * (`errors.<code>.title` / `errors.<code>.body`) instead of a hardcoded
 * English map. `retryable` / `needsCredits` are UI *behavior*, not
 * translatable text, so they stay as a static lookup here — this is the
 * reason the original design used stable `error.code` rather than
 * `error.message` in the first place (LESSONS_LEARNED: "stable error
 * codes, not localized messages").
 *
 * `describeError` is a plain function (not a hook) because it's called
 * from inside a `useMutation` error branch — callers must pass in a
 * `next-intl` translator scoped to the `errors` namespace, obtained via
 * `useTranslations('errors')` in the component.
 */

import type { useTranslations } from 'next-intl';

import { ApiClientError } from './api-client';

export interface DisplayableError {
  title: string;
  body: string;
  retryable: boolean;
  /** When set, UI should show a "Watch ad" affordance. */
  needsCredits: boolean;
}

type ErrorTranslator = ReturnType<typeof useTranslations>;

interface ErrorBehavior {
  retryable: boolean;
  needsCredits: boolean;
}

const BEHAVIOR: Record<string, ErrorBehavior> = {
  QUOTA_EXCEEDED: { retryable: false, needsCredits: true },
  RATE_LIMITED: { retryable: true, needsCredits: false },
  UPSTREAM_FAILED: { retryable: true, needsCredits: false },
  VALIDATION_FAILED: { retryable: false, needsCredits: false },
  INVALID_IMAGE: { retryable: false, needsCredits: false },
  FILE_TOO_LARGE: { retryable: false, needsCredits: false },
  UNSUPPORTED_MIME: { retryable: false, needsCredits: false },
  UNAUTHORIZED: { retryable: false, needsCredits: false },
  NOT_IMPLEMENTED: { retryable: false, needsCredits: false },
  AD_SESSION_INVALID: { retryable: true, needsCredits: false },
  AD_CAP_REACHED: { retryable: false, needsCredits: false },
};

const KNOWN_CODES = new Set(Object.keys(BEHAVIOR));

export function describeError(err: unknown, t: ErrorTranslator): DisplayableError {
  if (err instanceof ApiClientError) {
    if (KNOWN_CODES.has(err.code)) {
      const behavior = BEHAVIOR[err.code]!;
      return {
        title: t(`${err.code}.title`),
        body: t(`${err.code}.body`),
        retryable: behavior.retryable,
        needsCredits: behavior.needsCredits,
      };
    }
    return {
      title: t('generic.title'),
      body: err.message,
      retryable: true,
      needsCredits: false,
    };
  }

  return {
    title: t('generic.title'),
    body: err instanceof Error ? err.message : t('generic.unexpectedBody'),
    retryable: true,
    needsCredits: false,
  };
}
