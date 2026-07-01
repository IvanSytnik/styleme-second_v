/**
 * Supabase clients.
 *
 * - `supabasePublic` — anon key, used for read operations that respect RLS.
 * - `supabaseAdmin` — service role key, used for writes and admin operations.
 *   NEVER expose this client to a code path reachable by user input
 *   without authorization checks.
 *
 * Node 20 note: @supabase/supabase-js >= 2.50 requires a WebSocket
 * implementation for its realtime client. Node 22+ has it natively;
 * for Node 20 we provide `ws` explicitly. We don't actually use
 * realtime — but the client constructor still initializes it.
 *
 * Type assertion: the `ws` package's WebSocket has a slightly different
 * `ErrorEvent` shape than DOM WebSocket. Functionally compatible for our
 * usage (we never touch onerror), but TS rejects the substitution.
 * Localized `as never` is preferable to widening Supabase's option type.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

import { env, hasSupabase } from '../env';
import { logger } from '../logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtimeOptions = { transport: WebSocket as any };

export const supabasePublic: SupabaseClient | null = hasSupabase
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: realtimeOptions,
    })
  : null;

export const supabaseAdmin: SupabaseClient | null =
  hasSupabase && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: realtimeOptions,
      })
    : null;

if (!hasSupabase) {
  logger.warn('[supabase] Not configured — auth is disabled (development only)');
}
