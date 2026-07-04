'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { useAuth } from '@/lib/auth-provider';
import { ThemeSwitcher } from '@/features/theme/components/theme-switcher';
import { LanguageSwitcher } from '@/features/theme/components/language-switcher';
import { WatchAdButton } from '@/features/rewards/components/watch-ad-button';

import styles from './app-header.module.css';

/**
 * Top header — visible on every screen.
 *
 * Day 6 (ADR-009): the Watch-ad button is now live (provider-driven).
 * See features/rewards/. When NEXT_PUBLIC_AD_PROVIDER=off it renders
 * the Day 4 "Coming soon" state.
 * Day 7: strings moved to i18n (`header.*`); LanguageSwitcher added.
 */
export function AppHeader(): React.ReactElement {
  const t = useTranslations('header');
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
        aria-label={t('brandHomeAriaLabel')}
      >
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandName}>StyleMe</span>
      </button>

      <div className={styles.right}>
        {balance.isSuccess && (
          <div className={styles.balance} aria-label={t('creditsAriaLabel')}>
            <span className={styles.balanceItem}>
              <span className={styles.balanceLabel}>{t('freeLabel')}</span>
              <span className={styles.balanceValue}>
                {balance.data.freeRemaining}/{balance.data.freeDaily}
              </span>
            </span>
            {balance.data.rewarded > 0 && (
              <span className={styles.balanceItem}>
                <span className={styles.balanceLabel}>{t('bonusLabel')}</span>
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
            aria-label={t('openHistoryAriaLabel')}
          >
            <span aria-hidden="true">🕘</span>
            <span className={styles.historyLabel}>{t('historyLabel')}</span>
          </button>
        )}

        <WatchAdButton />

        <LanguageSwitcher />

        <ThemeSwitcher />
      </div>
    </header>
  );
}
