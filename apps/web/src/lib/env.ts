/**
 * Runtime-validated environment for the web app.
 */

import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  /**
   * Day 6 (ADR-009): which rewarded-ad provider to use.
   *  - 'dev' — built-in 15s modal, no real ad. Default for development.
   *  - 'gpt' — Google Publisher Tag rewarded ads (requires Ad Manager
   *            approval; adapter is a skeleton until then).
   *  - 'off' — button renders as "Coming soon" (set this in production
   *            until GPT is live, so users can't farm credits via the
   *            dev modal).
   */
  NEXT_PUBLIC_AD_PROVIDER: z.enum(['dev', 'gpt', 'off']).default('dev'),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_AD_PROVIDER: process.env.NEXT_PUBLIC_AD_PROVIDER,
});

export const hasSupabase = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
