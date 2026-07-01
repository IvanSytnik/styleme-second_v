/**
 * Cross-cutting constants. Both web and api must import from here.
 */

export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024,
  MAX_IMAGE_DIMENSION: 1024,
  JPEG_QUALITY: 90,
  MAX_CUSTOM_PROMPT_LENGTH: 100,
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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
