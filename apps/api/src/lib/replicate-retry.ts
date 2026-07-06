/**
 * Replicate 429 retry helpers (extracted from routes/transform.ts in
 * Day 8 for direct unit testing).
 *
 * Context (hotfix-429): Replicate throttles accounts with balance < $5
 * to 6 req/min with burst=1, surfacing as ApiError 429 with a
 * `"retry_after": N` fragment in the message. We retry up to 3 times,
 * honoring retry_after (capped at 10s) plus jitter.
 */

export const REPLICATE_MAX_ATTEMPTS = 3;
export const REPLICATE_MAX_RETRY_WAIT_MS = 10_000;
export const REPLICATE_DEFAULT_RETRY_WAIT_MS = 5_000;
export const REPLICATE_JITTER_MS = 1_000;

export function isReplicate429(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name !== 'ApiError') return false;
  const withResponse = err as Error & { response?: { status?: number } };
  if (withResponse.response?.status === 429) return true;
  return /\bstatus\s+429\b/i.test(err.message);
}

/**
 * Extract retry_after from the ApiError message, convert to ms, cap at
 * REPLICATE_MAX_RETRY_WAIT_MS, add jitter. `random` is injectable for
 * deterministic tests (defaults to Math.random).
 */
export function parseRetryAfterMs(err: unknown, random: () => number = Math.random): number {
  const msg = err instanceof Error ? err.message : '';
  const match = /"retry_after"\s*:\s*(\d+(?:\.\d+)?)/.exec(msg);
  const seconds = match ? Number.parseFloat(match[1]!) : NaN;
  const ms = Number.isFinite(seconds)
    ? Math.min(seconds * 1000, REPLICATE_MAX_RETRY_WAIT_MS)
    : REPLICATE_DEFAULT_RETRY_WAIT_MS;
  return ms + Math.floor(random() * REPLICATE_JITTER_MS);
}

/**
 * Normalize Replicate's output variants (FileOutput with .url(), plain
 * string, arrays of either) to a single URL string. Throws a plain Error
 * on unrecognized shape — the route layer wraps it into HttpError 502
 * (UPSTREAM_FAILED). Kept HttpError-free so this module has zero deps.
 */
export function extractResultUrl(output: unknown): string {
  if (
    output &&
    typeof output === 'object' &&
    'url' in output &&
    typeof (output as { url: () => string }).url === 'function'
  ) {
    return (output as { url: () => string }).url();
  }
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (
      first &&
      typeof first === 'object' &&
      'url' in first &&
      typeof (first as { url: () => string }).url === 'function'
    ) {
      return (first as { url: () => string }).url();
    }
  }
  throw new Error('UNEXPECTED_UPSTREAM_OUTPUT');
}
