'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './dev-ad-modal.module.css';

interface Props {
  /** Seconds the user must "watch" before the reward unlocks. */
  minWatchSeconds: number;
  /** Fired when the countdown finishes and the user taps Claim. */
  onComplete: () => void;
  /** Fired when the user closes early — no reward. */
  onDismiss: () => void;
}

/**
 * Development stand-in for a rewarded video (Day 6, ADR-009).
 *
 * Simulates the real UX contract of GPT rewarded ads:
 *   - fills the screen, can be dismissed early (→ no reward)
 *   - reward unlocks only after the full countdown
 *
 * The countdown matches the server's MIN_WATCH_SECONDS so the claim
 * never fires "too early". A real ad provider replaces this entire
 * component — the orchestration hook stays identical.
 *
 * PORTAL NOTE (hotfix): rendered into document.body via createPortal.
 * AppHeader (an ancestor in the React tree) uses `backdrop-filter`, which
 * per the CSS Filter Effects spec turns it into the containing block for
 * `position: fixed` descendants — so an in-tree modal positions relative
 * to the header, not the viewport, and drifts off-screen. Portaling to
 * <body> sidesteps the transformed ancestor entirely. This is why every
 * modal library (Radix, Headless UI) portals by default.
 */
export function DevAdModal({ minWatchSeconds, onComplete, onDismiss }: Props): React.ReactElement | null {
  const [remaining, setRemaining] = useState(minWatchSeconds);
  const [mounted, setMounted] = useState(false);
  const done = remaining <= 0;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Portals need a client-side document; guard SSR.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus the dialog on mount; Escape dismisses (no reward).
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  if (!mounted) return null;

  const progress = ((minWatchSeconds - remaining) / minWatchSeconds) * 100;

  const modal = (
    <div className={styles.backdrop} role="presentation">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Rewarded ad (development)"
        tabIndex={-1}
      >
        <div className={styles.devBadge}>DEV AD</div>

        <div className={styles.fakeVideo} aria-hidden="true">
          <span className={styles.fakeVideoIcon}>🎬</span>
          <p className={styles.fakeVideoText}>
            Imagine a riveting ad about hair products
          </p>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Ad progress"
        >
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>

        <p className={styles.timer} aria-live="polite">
          {done ? 'Reward unlocked!' : `Reward in ${remaining}s…`}
        </p>

        <div className={styles.actions}>
          {done ? (
            <button type="button" className={styles.claimButton} onClick={onComplete}>
              Claim +1 credit 🎉
            </button>
          ) : (
            <button type="button" className={styles.dismissButton} onClick={onDismiss}>
              Close (no reward)
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
