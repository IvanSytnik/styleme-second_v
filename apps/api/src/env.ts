/**
 * Runtime-validated environment.
 *
 * Throws on import if required env vars are missing or malformed.
 * Production is strict; development allows in-memory fallbacks when
 * Upstash/Supabase credentials are absent.
 *
 * Day 8 (ADR-012): + REPLICATE_MOCK — replaces the Replicate call with a
 * canned image for E2E tests. HARD-BLOCKED in production: a prod deploy
 * with the mock enabled would silently serve junk "generations" and write
 * garbage billing rows, so the process refuses to start.
 */

import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  REPLICATE_API_TOKEN: z.string().min(1, 'REPLICATE_API_TOKEN is required'),

  /** '1' → transform endpoints return a canned image (E2E only). */
  REPLICATE_MOCK: z.enum(['0', '1']).default('0'),

  // Supabase — server-side
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /**
   * Legacy HS256 JWT Secret. Required only for older Supabase projects
   * that still sign with HS256. Newer projects use asymmetric keys
   * (ES256/RS256) verified via the JWKS endpoint — for those this is unused.
   */
  SUPABASE_JWT_SECRET: z.string().optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('[env] Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';

if (isProd) {
  // Production: full Supabase + Upstash required. JWT secret is OPTIONAL —
  // modern projects use JWKS-based verification with no shared secret.
  const requiredInProd = [
    ['SUPABASE_URL', env.SUPABASE_URL],
    ['SUPABASE_ANON_KEY', env.SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
    ['UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL],
    ['UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN],
  ] as const;
  const missing = requiredInProd.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[env] Production requires: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (env.REPLICATE_MOCK === '1') {
    // eslint-disable-next-line no-console
    console.error(
      '[env] REPLICATE_MOCK=1 is forbidden in production — it would serve fake generations and corrupt billing data.',
    );
    process.exit(1);
  }
}

export const hasSupabase = Boolean(env.SUPABASE_URL);
export const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
export const isReplicateMock = env.REPLICATE_MOCK === '1' && !isProd;
