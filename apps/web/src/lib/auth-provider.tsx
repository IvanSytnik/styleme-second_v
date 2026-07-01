/**
 * Auth provider.
 *
 * On mount, ensures the visitor has a Supabase session — anonymous if no
 * other identity is present. Exposes the current user/session via context.
 *
 * When Supabase is not configured (dev fallback), `user` stays null and
 * `accessToken` stays undefined; the API still works in dev mode by
 * deriving a deterministic user id from the request on the server side.
 */

'use client';

import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { hasSupabase } from './env';
import { getSupabaseClient } from './supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  accessToken: string | undefined;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  accessToken: undefined,
  isReady: false,
});

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // No Supabase configured: we still mark ready so UI doesn't hang.
      setIsReady(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setSession(data.session);
        setIsReady(true);
        return;
      }
      // No session: sign in anonymously.
      const { data: anonData, error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[auth] anonymous sign-in failed', error);
      }
      setSession(anonData?.session ?? null);
      setIsReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      accessToken: session?.access_token,
      isReady,
    }),
    [session, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Lightweight token getter for the API client. Reads from a module-level
 * variable updated by `AuthProvider`. Avoids prop-drilling into the
 * non-React API client.
 */
let currentToken: string | undefined;
export function setAuthToken(token: string | undefined): void {
  currentToken = token;
}
export function getAuthToken(): string | undefined {
  return currentToken;
}

/** Bridge component to keep `currentToken` in sync with the provider. */
export function AuthTokenBridge(): null {
  const { accessToken } = useAuth();
  useEffect(() => {
    setAuthToken(accessToken);
  }, [accessToken]);
  return null;
}

export { hasSupabase };
