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
 *
 * Day 5 (ADR-008): list + softDelete added; insert now carries `mode`
 * and `customPrompt` for deterministic regenerate flow.
 */

import { randomUUID } from 'node:crypto';

import type { Generation, GenerationMode } from '@styleme/shared';

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../logger';

// ============================================================================
// Insert
// ============================================================================

export interface InsertGenerationInput {
  userId: string;
  mode: GenerationMode;
  styleId: number | null;
  styleName: string;
  /** Required iff mode === 'custom'; ignored otherwise. */
  customPrompt: string | null;
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
    mode: input.mode,
    style_id: input.styleId,
    style_name: input.styleName,
    custom_prompt: input.mode === 'custom' ? input.customPrompt : null,
    result_url: input.resultUrl,
    cost_cents: input.costCents,
  });

  if (error) {
    logger.error({ err: error, id }, '[generations] insert failed (non-fatal)');
  }

  return id;
}

// ============================================================================
// List (cursor paginated)
// ============================================================================

/**
 * Opaque cursor = base64(`${createdAt}|${id}`).
 * Encoded so clients can't parse or forge it; server treats it as a
 * bearer token that resolves to a `(created_at < X) OR (created_at = X AND id < Y)`
 * predicate for stable pagination even when many rows share the same second.
 */
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sepIdx = raw.indexOf('|');
    if (sepIdx <= 0) return null;
    const createdAt = raw.slice(0, sepIdx);
    const id = raw.slice(sepIdx + 1);
    if (!createdAt || !id) return null;
    // Basic sanity — must parse as date, id must be uuid-ish
    if (Number.isNaN(Date.parse(createdAt))) return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

interface GenerationRow {
  id: string;
  user_id: string;
  mode: GenerationMode;
  style_id: number | null;
  style_name: string;
  custom_prompt: string | null;
  result_url: string;
  cost_cents: number;
  created_at: string;
  deleted_at: string | null;
}

function rowToGeneration(row: GenerationRow): Generation {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    styleId: row.style_id,
    styleName: row.style_name,
    customPrompt: row.custom_prompt,
    resultUrl: row.result_url,
    costCents: row.cost_cents,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export interface ListGenerationsInput {
  userId: string;
  cursor?: string;
  limit: number;
}

export interface ListGenerationsResult {
  items: Generation[];
  nextCursor: string | null;
}

export async function listGenerations(
  input: ListGenerationsInput,
): Promise<ListGenerationsResult> {
  if (!supabaseAdmin) {
    logger.warn('[generations] Supabase not configured — returning empty page');
    return { items: [], nextCursor: null };
  }

  // Fetch one extra to detect whether there's a next page.
  const fetchSize = input.limit + 1;

  let query = supabaseAdmin
    .from('generations')
    .select('*')
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchSize);

  if (input.cursor) {
    const decoded = decodeCursor(input.cursor);
    if (decoded) {
      // Keyset pagination — stable even under equal-timestamp rows.
      // `.or()` string here is intentional: PostgREST does not expose
      // tuple comparison, so we express `(t < X) OR (t = X AND id < Y)`.
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    }
    // Malformed cursor → ignore & return first page. Non-fatal.
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ err: error, userId: input.userId }, '[generations] list failed');
    throw new Error('Failed to load generations');
  }

  const rows = (data ?? []) as GenerationRow[];
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit).map(rowToGeneration);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

  return { items, nextCursor };
}

// ============================================================================
// Soft delete
// ============================================================================

/**
 * Marks the row as deleted. Returns `true` iff a row was actually updated —
 * so the caller can distinguish "user tried to delete someone else's row
 * or a nonexistent id" (returns false / 404) from success.
 *
 * We use `.eq('user_id', userId)` even though RLS would enforce it — belt
 * and suspenders. If the service-role config is ever removed and this
 * runs through anon-key + RLS, the query still behaves.
 */
export async function softDeleteGeneration(
  userId: string,
  id: string,
): Promise<boolean> {
  if (!supabaseAdmin) {
    logger.warn('[generations] Supabase not configured — nothing to delete');
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from('generations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    logger.error({ err: error, userId, id }, '[generations] delete failed');
    throw new Error('Failed to delete generation');
  }

  return (data ?? []).length > 0;
}
