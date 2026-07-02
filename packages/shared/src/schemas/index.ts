/**
 * Zod schemas for API request validation.
 *
 * Both web (form validation) and api (request body validation) import from here.
 * Drift between client and server validation is now impossible by construction.
 */

import { z } from 'zod';

import { LIMITS } from '../constants/limits';

export const transformByStyleIdSchema = z.object({
  styleId: z.coerce.number().int().min(1).max(40),
});

/**
 * Day 4 (ADR-007): bounds updated to [MIN_CUSTOM_PROMPT_LENGTH, MAX_CUSTOM_PROMPT_LENGTH].
 * `trim()` runs before `min` so whitespace padding cannot bypass the MIN bound.
 */
export const transformCustomSchema = z.object({
  hairstyle: z
    .string()
    .trim()
    .min(
      LIMITS.MIN_CUSTOM_PROMPT_LENGTH,
      `Hairstyle description must be at least ${LIMITS.MIN_CUSTOM_PROMPT_LENGTH} characters`,
    )
    .max(
      LIMITS.MAX_CUSTOM_PROMPT_LENGTH,
      `Hairstyle description must be ${LIMITS.MAX_CUSTOM_PROMPT_LENGTH} characters or less`,
    ),
});

export const grantRewardSchema = z.object({
  /**
   * Ad-network token. In production this must be verified against the
   * ad-network's signature. In development the dev-only endpoint accepts
   * any non-empty string for smoke testing.
   */
  token: z.string().min(1),
});

/**
 * Day 5 (ADR-008): pagination for GET /api/generations.
 *
 * `cursor` is a base64-encoded (createdAt, id) tuple issued by the server.
 * Clients pass it back verbatim; we don't validate its shape here beyond
 * "string, sanity-limited length" because malformed cursors just yield
 * an empty page rather than throwing.
 */
export const listGenerationsQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type TransformByStyleIdInput = z.infer<typeof transformByStyleIdSchema>;
export type TransformCustomInput = z.infer<typeof transformCustomSchema>;
export type GrantRewardInput = z.infer<typeof grantRewardSchema>;
export type ListGenerationsQuery = z.infer<typeof listGenerationsQuerySchema>;
