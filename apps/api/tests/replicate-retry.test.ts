/**
 * Replicate retry helpers — unit tests for the hotfix-429 logic.
 */

import { describe, expect, it } from 'vitest';

import {
  REPLICATE_DEFAULT_RETRY_WAIT_MS,
  REPLICATE_JITTER_MS,
  REPLICATE_MAX_RETRY_WAIT_MS,
  extractResultUrl,
  isReplicate429,
  parseRetryAfterMs,
} from '../src/lib/replicate-retry';

function apiError(message: string, status?: number): Error {
  const err = new Error(message) as Error & { response?: { status?: number } };
  err.name = 'ApiError';
  if (status !== undefined) err.response = { status };
  return err;
}

const noJitter = (): number => 0;
const maxJitter = (): number => 0.999_999;

describe('isReplicate429', () => {
  it('detects 429 via response.status', () => {
    expect(isReplicate429(apiError('anything', 429))).toBe(true);
  });

  it('detects 429 via "status 429" in the message', () => {
    expect(isReplicate429(apiError('Request failed with status 429: rate limited'))).toBe(true);
  });

  it('ignores other statuses and non-ApiError errors', () => {
    expect(isReplicate429(apiError('boom', 500))).toBe(false);
    const plain = new Error('status 429'); // right message, wrong name
    expect(isReplicate429(plain)).toBe(false);
    expect(isReplicate429('status 429')).toBe(false);
    expect(isReplicate429(null)).toBe(false);
  });
});

describe('parseRetryAfterMs', () => {
  it('extracts retry_after seconds from the JSON fragment in the message', () => {
    const err = apiError('429 {"detail":"...", "retry_after": 7}');
    expect(parseRetryAfterMs(err, noJitter)).toBe(7000);
  });

  it('supports fractional retry_after', () => {
    const err = apiError('{"retry_after": 2.5}');
    expect(parseRetryAfterMs(err, noJitter)).toBe(2500);
  });

  it('caps at REPLICATE_MAX_RETRY_WAIT_MS', () => {
    const err = apiError('{"retry_after": 3600}');
    expect(parseRetryAfterMs(err, noJitter)).toBe(REPLICATE_MAX_RETRY_WAIT_MS);
  });

  it('falls back to the default wait when retry_after is absent', () => {
    const err = apiError('429 no hint here');
    expect(parseRetryAfterMs(err, noJitter)).toBe(REPLICATE_DEFAULT_RETRY_WAIT_MS);
  });

  it('adds bounded jitter', () => {
    const err = apiError('{"retry_after": 1}');
    const withMax = parseRetryAfterMs(err, maxJitter);
    expect(withMax).toBeGreaterThanOrEqual(1000);
    expect(withMax).toBeLessThan(1000 + REPLICATE_JITTER_MS);
  });

  it('survives non-Error input', () => {
    expect(parseRetryAfterMs('not an error', noJitter)).toBe(REPLICATE_DEFAULT_RETRY_WAIT_MS);
  });
});

describe('extractResultUrl', () => {
  const URL = 'https://replicate.delivery/x/out.png';

  it('handles FileOutput-like objects with url()', () => {
    expect(extractResultUrl({ url: () => URL })).toBe(URL);
  });

  it('handles plain string output', () => {
    expect(extractResultUrl(URL)).toBe(URL);
  });

  it('handles arrays of strings and arrays of FileOutput', () => {
    expect(extractResultUrl([URL])).toBe(URL);
    expect(extractResultUrl([{ url: () => URL }])).toBe(URL);
  });

  it('throws on unrecognized shapes', () => {
    expect(() => extractResultUrl(null)).toThrow();
    expect(() => extractResultUrl(42)).toThrow();
    expect(() => extractResultUrl([])).toThrow();
    expect(() => extractResultUrl({ nope: true })).toThrow();
  });
});
