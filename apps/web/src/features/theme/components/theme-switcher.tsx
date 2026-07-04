'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import styles from './theme-switcher.module.css';

type Mode = 'light' | 'dark' | 'system';

/**
 * Three-state theme switcher: System / Light / Dark.
 *
 * Hydration note: theme is undefined on first render (server has no access
 * to client preferences). We render a hidden placeholder until mounted to
 * keep server and client markup identical and avoid hydration mismatch.
 *
 * Day 7: labels moved to i18n (`theme.*`).
 */
export function ThemeSwitcher(): React.ReactElement | null {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reserve space pre-mount to avoid layout shift, but render nothing visible.
  if (!mounted) {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  const current = (theme ?? 'system') as Mode;

  const options: { value: Mode; label: string; icon: string }[] = [
    { value: 'light', label: t('light'), icon: '☀' },
    { value: 'system', label: t('system'), icon: '⌥' },
    { value: 'dark', label: t('dark'), icon: '☾' },
  ];

  return (
    <div className={styles.switcher} role="radiogroup" aria-label={t('ariaLabel')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={current === opt.value}
          aria-label={opt.label}
          className={`${styles.option} ${current === opt.value ? styles.active : ''}`}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
        >
          <span aria-hidden="true">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
