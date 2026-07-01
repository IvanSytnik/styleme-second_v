/**
 * Browser-side Supabase client.
 *
 * Singleton; persists session in localStorage so anonymous sign-in survives
 * page reloads. Returns `null` if Supabase env vars are not configured —
 * code that needs the client must check first.
 */

'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { hasSupabase, publicEnv } from './env';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (_client) return _client;
  _client = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
