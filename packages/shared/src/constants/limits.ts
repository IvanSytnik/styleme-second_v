/**
 * Cross-cutting constants. Both web and api must import from here.
 */

export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024,
  MAX_IMAGE_DIMENSION: 1024,
  JPEG_QUALITY: 90,
  /**
   * Custom prompt length bounds (Day 4, ADR-007).
   */
  MIN_CUSTOM_PROMPT_LENGTH: 10,
  MAX_CUSTOM_PROMPT_LENGTH: 200,
  MAX_JSON_BODY_BYTES: 256 * 1024,
} as const;

export const QUOTA = {
  /** Free generations per day per user. */
  FREE_DAILY: 3,
  /** Max rewarded credits a single user can accumulate. */
  MAX_REWARDED_BALANCE: 50,
  /** Rewarded credits expire this many days after grant. */
  REWARD_TTL_DAYS: 7,
} as const;

/**
 * Rewarded-ad flow (Day 6, ADR-009).
 *
 * Web rewarded ads have NO server-side verification (SSV is AdMob/mobile
 * only). These parameters make fraud expensive and cap blast radius:
 * worst-case farmed value = MAX_VIEWS_PER_DAY * $0.04 = $0.40/user/day,
 * throttled further by the transform rate limit downstream.
 */
export const AD_REWARDS = {
  /** Credits granted per completed view. */
  CREDITS_PER_VIEW: 1,
  /** Max rewarded views per user per UTC day. */
  MAX_VIEWS_PER_DAY: 10,
  /** Minimum seconds between session issue and claim (≈ ad duration). */
  MIN_WATCH_SECONDS: 15,
  /** Nonce lifetime — claim after this is rejected. */
  SESSION_TTL_SECONDS: 300,
} as const;

export const RATE_LIMITS = {
  TRANSFORM_PER_USER_PER_HOUR: 10,
  API_PER_IP_PER_MINUTE: 60,
  AUTH_PER_IP_PER_HOUR: 20,
} as const;

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_IMAGE: 'INVALID_IMAGE',
  INVALID_STYLE_ID: 'INVALID_STYLE_ID',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MIME: 'UNSUPPORTED_MIME',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_FAILED: 'UPSTREAM_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIG_MISSING: 'CONFIG_MISSING',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  /** Day 6: ad session nonce missing/expired/foreign/too-early/reused. */
  AD_SESSION_INVALID: 'AD_SESSION_INVALID',
  /** Day 6: user hit MAX_VIEWS_PER_DAY. */
  AD_CAP_REACHED: 'AD_CAP_REACHED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
