'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { useAuth } from '@/lib/auth-provider';
import { ThemeSwitcher } from '@/features/theme/components/theme-switcher';

import styles from './app-header.module.css';

/**
 * Top header — visible on every screen.
 *
 * Day 5 (ADR-008): + History button. Opens the history screen from anywhere.
 * Hidden when user is on history-detail (back button is used instead).
 */
export function AppHeader(): React.ReactElement {
  const reset = useAppStore((s) => s.reset);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const { isReady } = useAuth();

  const balance = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.getBalance(),
    enabled: isReady,
    staleTime: 30_000,
  });

  const showHistoryButton = screen !== 'history' && screen !== 'history-detail';

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

        {showHistoryButton && (
          <button
            type="button"
            className={styles.historyButton}
            onClick={() => setScreen('history')}
            aria-label="Open history"
          >
            <span aria-hidden="true">🕘</span>
            <span className={styles.historyLabel}>History</span>
          </button>
        )}

        {/* Watch ad Coming Soon */}
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
