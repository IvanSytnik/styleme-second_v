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
    .min(2, 'Hairstyle description is too short')
    .max(LIMITS.MAX_CUSTOM_PROMPT_LENGTH, 'Hairstyle description is too long'),
});

export const grantRewardSchema = z.object({
  /**
   * Ad-network token. In production this must be verified against the
   * ad-network's signature. In development the dev-only endpoint accepts
   * any non-empty string for smoke testing.
   */
  token: z.string().min(1),
});

export type TransformByStyleIdInput = z.infer<typeof transformByStyleIdSchema>;
export type TransformCustomInput = z.infer<typeof transformCustomSchema>;
export type GrantRewardInput = z.infer<typeof grantRewardSchema>;
