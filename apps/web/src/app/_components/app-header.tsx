'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { useAuth } from '@/lib/auth-provider';
import { ThemeSwitcher } from '@/features/theme/components/theme-switcher';

import styles from './app-header.module.css';

/**
 * Top header — visible on every screen.
 * Shows brand, current quota balance, and the theme switcher.
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
      <button type="button" className={styles.brand} onClick={reset} aria-label="StyleMe — home">
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
        <ThemeSwitcher />
      </div>
    </header>
  );
}
