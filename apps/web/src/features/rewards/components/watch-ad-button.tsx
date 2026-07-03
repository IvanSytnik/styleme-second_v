'use client';

import { toast } from 'sonner';

import { publicEnv } from '@/lib/env';

import { useAdReward } from '../api/use-ad-reward';
import { showGptRewardedAd } from '../lib/gpt-provider';

import { DevAdModal } from './dev-ad-modal';

import styles from './watch-ad-button.module.css';

/**
 * Watch-ad button (Day 6, ADR-009).
 *
 * Provider-aware:
 *   - 'off' → renders the Day 4 "Coming soon" disabled state. Set this in
 *             production until GPT is approved, so users can't farm
 *             credits via the dev modal.
 *   - 'dev' → 15s countdown modal; timer matches the server's
 *             MIN_WATCH_SECONDS so claims never fire too early.
 *   - 'gpt' → real GPT rewarded ad (skeleton until Ad Manager approval).
 */
export function WatchAdButton(): React.ReactElement {
  const provider = publicEnv.NEXT_PUBLIC_AD_PROVIDER;
  const { phase, session, startSession, claim, cancel } = useAdReward();

  // ---------- provider off → Coming soon (Day 4 behaviour) ----------
  if (provider === 'off') {
    return (
      <button
        type="button"
        className={styles.buttonDisabled}
        disabled
        title="Coming soon — watch ads to earn extra generations"
        aria-label="Watch ad for credit — coming soon"
      >
        <span aria-hidden="true">🎬</span>
        <span className={styles.label}>Watch ad</span>
        <span className={styles.comingSoon}>Soon</span>
      </button>
    );
  }

  const busy = phase === 'starting' || phase === 'claiming';

  async function handleClick(): Promise<void> {
    const s = await startSession();
    if (!s) return; // toast already shown by the hook

    if (provider === 'gpt') {
      // Real ad path — the modal is Google's, not ours.
      const result = await showGptRewardedAd();
      if (result === 'granted') {
        await claim(s.nonce);
      } else {
        if (result === 'error') {
          toast.error('Ads are unavailable right now. Please try again later.');
        }
        cancel();
      }
    }
    // provider === 'dev' → modal renders below while phase === 'watching'
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => void handleClick()}
        disabled={busy || phase === 'watching'}
        aria-busy={busy}
        aria-label="Watch an ad to earn one extra generation"
      >
        <span aria-hidden="true">🎬</span>
        <span className={styles.label}>
          {phase === 'starting'
            ? 'Loading…'
            : phase === 'claiming'
              ? 'Claiming…'
              : 'Watch ad'}
        </span>
        <span className={styles.plusOne}>+1</span>
      </button>

      {provider === 'dev' && phase === 'watching' && session && (
        <DevAdModal
          minWatchSeconds={session.minWatchSeconds}
          onComplete={() => void claim(session.nonce)}
          onDismiss={cancel}
        />
      )}
    </>
  );
}
