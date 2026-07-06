/**
 * Shared Zod schema tests — the same schemas validate on web (forms) and
 * api (request bodies), so these tests protect BOTH sides at once.
 */

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { LIMITS } from '../src/constants/limits';
import {
  grantRewardSchema,
  listGenerationsQuerySchema,
  transformByStyleIdSchema,
  transformCustomSchema,
} from '../src/schemas';

describe('transformByStyleIdSchema', () => {
  it('coerces multipart string fields to numbers', () => {
    // multipart/form-data delivers everything as strings — coercion is load-bearing.
    expect(transformByStyleIdSchema.parse({ styleId: '7' })).toEqual({ styleId: 7 });
  });

  it('rejects out-of-range, non-integer, and missing ids', () => {
    expect(transformByStyleIdSchema.safeParse({ styleId: 0 }).success).toBe(false);
    expect(transformByStyleIdSchema.safeParse({ styleId: 41 }).success).toBe(false);
    expect(transformByStyleIdSchema.safeParse({ styleId: 2.5 }).success).toBe(false);
    expect(transformByStyleIdSchema.safeParse({}).success).toBe(false);
  });
});

describe('transformCustomSchema', () => {
  it('trims and accepts within limits', () => {
    const text = 'short curly bob with bangs';
    expect(transformCustomSchema.parse({ hairstyle: `  ${text}  ` })).toEqual({
      hairstyle: text,
    });
  });

  it('enforces min length AFTER trim (whitespace padding cannot cheat)', () => {
    const padded = ' '.repeat(50) + 'ab' + ' '.repeat(50);
    expect(transformCustomSchema.safeParse({ hairstyle: padded }).success).toBe(false);
  });

  it('enforces max length', () => {
    const tooLong = 'x'.repeat(LIMITS.MAX_CUSTOM_PROMPT_LENGTH + 1);
    expect(transformCustomSchema.safeParse({ hairstyle: tooLong }).success).toBe(false);
    const maxOk = 'x'.repeat(LIMITS.MAX_CUSTOM_PROMPT_LENGTH);
    expect(transformCustomSchema.safeParse({ hairstyle: maxOk }).success).toBe(true);
  });
});

describe('grantRewardSchema', () => {
  it('accepts a uuid nonce', () => {
    expect(grantRewardSchema.safeParse({ nonce: randomUUID() }).success).toBe(true);
  });

  it('rejects non-uuid nonces (fabrication cheapest to reject at the edge)', () => {
    expect(grantRewardSchema.safeParse({ nonce: 'abc' }).success).toBe(false);
    expect(grantRewardSchema.safeParse({ nonce: '' }).success).toBe(false);
    expect(grantRewardSchema.safeParse({}).success).toBe(false);
  });
});

describe('listGenerationsQuerySchema', () => {
  it('defaults limit to 20 and coerces query-string numbers', () => {
    expect(listGenerationsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listGenerationsQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
  });

  it('bounds limit to [1, 50] and cursor to 256 chars', () => {
    expect(listGenerationsQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(listGenerationsQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(
      listGenerationsQuerySchema.safeParse({ cursor: 'x'.repeat(257) }).success,
    ).toBe(false);
  });
});
