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

/**
 * Day 6 (ADR-009): grant-reward is claimed with a server-issued nonce,
 * not an ad-network token. The nonce was issued by POST /api/billing/ad-session
 * and is bound to the requesting user + a minimum-watch timer.
 */
export const grantRewardSchema = z.object({
  nonce: z.string().uuid('Invalid ad session'),
});

export const listGenerationsQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type TransformByStyleIdInput = z.infer<typeof transformByStyleIdSchema>;
export type TransformCustomInput = z.infer<typeof transformCustomSchema>;
export type GrantRewardInput = z.infer<typeof grantRewardSchema>;
export type ListGenerationsQuery = z.infer<typeof listGenerationsQuerySchema>;
