'use client';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import type { AdSession } from '@styleme/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { describeError } from '@/lib/error-messages';

/**
 * Rewarded-ad orchestration (Day 6, ADR-009).
 *
 * State machine:
 *   idle → starting (POST ad-session) → watching (provider shows the ad)
 *        → claiming (POST grant-reward) → idle
 *
 * Split into two explicit steps so the WatchAdButton can render the
 * dev modal between `startSession` and `claim` — the hook doesn't own
 * any UI, only the network + cache side effects.
 *
 * Day 7 hotfix: `describeError(err)` → `describeError(err, t)`
 * (matches the D3 signature change from Wave 1 — this file wasn't in
 * the original file-review set, caught by `tsc` at typecheck time, not
 * shipped broken). Also moved the two hardcoded toast strings
 * (`+1 credit earned! 🎉`, `Could not claim the reward...`) to i18n
 * (`rewards.creditEarnedToast` / `rewards.claimFailedToast`) — same
 * class of gap, just not TS-visible, so worth fixing in the same pass
 * rather than leaving English text next to a signature-only fix.
 *
 * `useTranslations` is called here because `useAdReward` is itself a
 * hook (not a plain function) — calling another hook at its top level
 * is standard Rules-of-Hooks-compliant composition, same as any other
 * hook-in-a-hook pattern (e.g. `useQueryClient` below).
 */
export type AdRewardPhase = 'idle' | 'starting' | 'watching' | 'claiming';

interface UseAdRewardResult {
  phase: AdRewardPhase;
  session: AdSession | null;
  /** Step 1: mint the nonce. Returns the session or null on failure. */
  startSession: () => Promise<AdSession | null>;
  /** Step 2 (after the ad completes): claim the reward. */
  claim: (nonce: string) => Promise<boolean>;
  /** Abort: user dismissed the ad — reset to idle without claiming. */
  cancel: () => void;
}

export function useAdReward(): UseAdRewardResult {
  const t = useTranslations('errors');
  const tRewards = useTranslations('rewards');
  const qc = useQueryClient();
  const [phase, setPhase] = useState<AdRewardPhase>('idle');
  const [session, setSession] = useState<AdSession | null>(null);

  const startSession = useCallback(async (): Promise<AdSession | null> => {
    setPhase('starting');
    try {
      const s = await api.startAdSession();
      setSession(s);
      setPhase('watching');
      return s;
    } catch (err) {
      const d = describeError(err, t);
      toast.error(d.body);
      setPhase('idle');
      setSession(null);
      return null;
    }
  }, [t]);

  const claim = useCallback(
    async (nonce: string): Promise<boolean> => {
      setPhase('claiming');
      try {
        const balance = await api.grantReward(nonce);
        qc.setQueryData(['balance'], balance);
        toast.success(tRewards('creditEarnedToast'));
        setPhase('idle');
        setSession(null);
        return true;
      } catch (err) {
        // AD_SESSION_INVALID with 'too-early' semantics is retryable —
        // but the dev modal enforces the timer client-side, so in practice
        // this fires only on expired/replayed nonces.
        if (err instanceof ApiClientError) {
          const d = describeError(err, t);
          toast.error(d.body);
        } else {
          toast.error(tRewards('claimFailedToast'));
        }
        setPhase('idle');
        setSession(null);
        return false;
      }
    },
    [qc, t, tRewards],
  );

  const cancel = useCallback((): void => {
    setPhase('idle');
    setSession(null);
  }, []);

  return { phase, session, startSession, claim, cancel };
}
