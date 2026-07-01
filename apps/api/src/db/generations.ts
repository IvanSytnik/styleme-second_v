/**
 * Generations table access (Supabase Postgres).
 *
 * Each successful transform is recorded for: user history, billing
 * reconciliation, and analytics. Writes use the service-role client
 * because the request handler already authenticated the user via JWT
 * and we don't want to round-trip through the user's anon session.
 *
 * RLS policy (defined in supabase/migrations) restricts SELECT to
 * `auth.uid() = user_id`, so users can only read their own rows.
 */

import { randomUUID } from 'node:crypto';

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../logger';

export interface InsertGenerationInput {
  userId: string;
  styleId: number | null;
  styleName: string;
  resultUrl: string;
  costCents: number;
}

export async function insertGeneration(input: InsertGenerationInput): Promise<string> {
  // Generate id client-side so we can return it even if the insert fails
  // (we still surface the result to the user — losing a history row is
  // not worth failing the whole transform on).
  const id = randomUUID();

  if (!supabaseAdmin) {
    logger.warn({ id }, '[generations] Supabase not configured — skipping persistence');
    return id;
  }

  const { error } = await supabaseAdmin.from('generations').insert({
    id,
    user_id: input.userId,
    style_id: input.styleId,
    style_name: input.styleName,
    result_url: input.resultUrl,
    cost_cents: input.costCents,
  });

  if (error) {
    logger.error({ err: error, id }, '[generations] insert failed (non-fatal)');
  }

  return id;
}
