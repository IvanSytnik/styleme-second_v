'use client';

import { useTranslations } from 'next-intl';

import styles from './mode-selector.module.css';

export type CatalogMode = 'gallery' | 'custom' | 'reference';

interface Props {
  value: CatalogMode;
  onChange: (mode: CatalogMode) => void;
}

/**
 * Day 7: labels/descriptions moved to i18n (`catalog.modeSelector.*`).
 * The mode list itself (id + icon) stays static — only the id is used
 * for logic, icon is decorative and language-agnostic.
 */
export function ModeSelector({ value, onChange }: Props): React.ReactElement {
  const t = useTranslations('catalog.modeSelector');

  const MODES: ReadonlyArray<{ id: CatalogMode; icon: string }> = [
    { id: 'gallery', icon: '🎨' },
    { id: 'custom', icon: '✍️' },
    { id: 'reference', icon: '📸' },
  ];

  return (
    <div className={styles.root} role="radiogroup" aria-label={t('ariaLabel')}>
      {MODES.map((mode) => {
        const selected = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.mode} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(mode.id)}
          >
            <span className={styles.icon} aria-hidden="true">
              {mode.icon}
            </span>
            <span className={styles.label}>{t(`${mode.id}.label`)}</span>
            <span className={styles.description}>{t(`${mode.id}.description`)}</span>
          </button>
        );
      })}
    </div>
  );
}
