'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
      const d = describeError(err);
      toast.error(d.body);
      setPhase('idle');
      setSession(null);
      return null;
    }
  }, []);

  const claim = useCallback(
    async (nonce: string): Promise<boolean> => {
      setPhase('claiming');
      try {
        const balance = await api.grantReward(nonce);
        qc.setQueryData(['balance'], balance);
        toast.success('+1 credit earned! 🎉');
        setPhase('idle');
        setSession(null);
        return true;
      } catch (err) {
        // AD_SESSION_INVALID with 'too-early' semantics is retryable —
        // but the dev modal enforces the timer client-side, so in practice
        // this fires only on expired/replayed nonces.
        if (err instanceof ApiClientError) {
          const d = describeError(err);
          toast.error(d.body);
        } else {
          toast.error('Could not claim the reward. Please try again.');
        }
        setPhase('idle');
        setSession(null);
        return false;
      }
    },
    [qc],
  );

  const cancel = useCallback((): void => {
    setPhase('idle');
    setSession(null);
  }, []);

  return { phase, session, startSession, claim, cancel };
}
