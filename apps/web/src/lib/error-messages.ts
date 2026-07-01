/**
 * Maps stable API error codes to user-facing messages.
 *
 * These will be replaced with i18n keys in Day 7. For now, English messages
 * with a small set of well-known codes. Unknown codes fall back to the
 * server-provided message.
 */

import { ApiClientError } from './api-client';

export interface DisplayableError {
  title: string;
  body: string;
  retryable: boolean;
  /** When set, UI should show a "Watch ad" affordance. */
  needsCredits: boolean;
}

const MAP: Record<string, Omit<DisplayableError, 'body'> & { body?: string }> = {
  QUOTA_EXCEEDED: {
    title: 'No credits left',
    body: 'You\'ve used all your free generations for today. Watch an ad to earn more, or come back tomorrow.',
    retryable: false,
    needsCredits: true,
  },
  RATE_LIMITED: {
    title: 'Too fast',
    body: 'Please wait a moment before trying again.',
    retryable: true,
    needsCredits: false,
  },
  UPSTREAM_FAILED: {
    title: 'Generation failed',
    body: 'The AI service had trouble processing your image. Please try again.',
    retryable: true,
    needsCredits: false,
  },
  VALIDATION_FAILED: {
    title: 'Invalid request',
    body: 'Please check your image and try again.',
    retryable: false,
    needsCredits: false,
  },
  INVALID_IMAGE: {
    title: 'Invalid image',
    body: 'This image cannot be processed. Try a different photo with a clear view of the face.',
    retryable: false,
    needsCredits: false,
  },
  FILE_TOO_LARGE: {
    title: 'Image too large',
    body: 'Please use an image smaller than 10 MB. We\'ll resize it for you.',
    retryable: false,
    needsCredits: false,
  },
  UNSUPPORTED_MIME: {
    title: 'Unsupported format',
    body: 'Please use a JPEG, PNG, or WebP image.',
    retryable: false,
    needsCredits: false,
  },
  UNAUTHORIZED: {
    title: 'Session expired',
    body: 'Please refresh the page to continue.',
    retryable: false,
    needsCredits: false,
  },
  NOT_IMPLEMENTED: {
    title: 'Coming soon',
    body: 'This feature isn\'t available yet.',
    retryable: false,
    needsCredits: false,
  },
};

export function describeError(err: unknown): DisplayableError {
  if (err instanceof ApiClientError) {
    const mapped = MAP[err.code];
    if (mapped) {
      return {
        title: mapped.title,
        body: mapped.body ?? err.message,
        retryable: mapped.retryable,
        needsCredits: mapped.needsCredits,
      };
    }
    return {
      title: 'Something went wrong',
      body: err.message,
      retryable: true,
      needsCredits: false,
    };
  }

  return {
    title: 'Something went wrong',
    body: err instanceof Error ? err.message : 'Unexpected error',
    retryable: true,
    needsCredits: false,
  };
}
