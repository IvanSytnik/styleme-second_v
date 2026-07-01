'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { useAuth } from '@/lib/auth-provider';
import { ThemeSwitcher } from '@/features/theme/components/theme-switcher';

import styles from './app-header.module.css';

/**
 * Top header — visible on every screen.
 * Shows brand, current quota balance, "Watch ad" affordance, theme switcher.
 *
 * Day 4 (ADR-007): "Watch ad" button visible-but-disabled with a "Soon" badge.
 * The button makes NO network call — clicking does nothing, avoiding the 501
 * that /api/billing/grant-reward returns in prod. Real AdSense integration
 * lands in Day 6.
 */
export function AppHeader(): React.ReactElement {
  const reset = useAppStore((s) => s.reset);
  const { isReady } = useAuth();

  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.getBalance(),
    enabled: isReady,
    staleTime: 30_000,
  });

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.brand}
        onClick={reset}
        aria-label="StyleMe — home"
      >
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandName}>StyleMe</span>
      </button>

      <div className={styles.right}>
        {balance.isSuccess && (
          <div className={styles.balance} aria-label="Credits">
            <span className={styles.balanceItem}>
              <span className={styles.balanceLabel}>Free</span>
              <span className={styles.balanceValue}>
                {balance.data.freeRemaining}/{balance.data.freeDaily}
              </span>
            </span>
            {balance.data.rewarded > 0 && (
              <span className={styles.balanceItem}>
                <span className={styles.balanceLabel}>Bonus</span>
                <span className={styles.balanceValue}>+{balance.data.rewarded}</span>
              </span>
            )}
          </div>
        )}

        {/* Day 4: Watch ad Coming Soon — visible affordance, no network call. */}
        <button
          type="button"
          className={styles.watchAd}
          disabled
          title="Coming soon — watch ads to earn extra generations"
          aria-label="Watch ad for credit — coming soon"
        >
          <span aria-hidden="true">🎬</span>
          <span className={styles.watchAdLabel}>Watch ad</span>
          <span className={styles.comingSoon}>Soon</span>
        </button>

        <ThemeSwitcher />
      </div>
    </header>
  );
}
