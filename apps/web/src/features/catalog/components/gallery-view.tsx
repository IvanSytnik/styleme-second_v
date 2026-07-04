'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  FEMALE_HAIRSTYLES,
  MALE_HAIRSTYLES,
  type Gender,
  type HairstyleListItem,
} from '@styleme/shared';

import { useAppStore } from '@/lib/app-store';

import styles from './gallery-view.module.css';

/**
 * Gallery view (Day 3 flow preserved).
 *
 * Sets mode=preset + selectedStyleId, then navigates to processing.
 * The processing screen runs the mutation on mount.
 *
 * Day 7 (ADR-010 / D2): style names no longer come from `@styleme/shared`
 * (the `name` field was removed) — resolved here via i18n, keyed by the
 * same numeric `id` that's already the DB/API identity.
 */
export function GalleryView(): React.ReactElement {
  const t = useTranslations('catalog');
  const tPresets = useTranslations('catalog.hairstyle.presets');

  const selectedStyleId = useAppStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useAppStore((s) => s.setSelectedStyleId);
  const setMode = useAppStore((s) => s.setMode);
  const setScreen = useAppStore((s) => s.setScreen);

  const [gender, setGender] = useState<Gender>('female');

  const list: readonly HairstyleListItem[] = useMemo(
    () => (gender === 'female' ? FEMALE_HAIRSTYLES : MALE_HAIRSTYLES),
    [gender],
  );

  function start(): void {
    if (selectedStyleId === null) return;
    setMode('preset');
    setScreen('processing');
  }

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label={t('genderTabsLabel')}>
        {(['female', 'male'] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={gender === g}
            className={`${styles.tab} ${gender === g ? styles.tabActive : ''}`}
            onClick={() => setGender(g)}
          >
            {g === 'female' ? t('genderFemale') : t('genderMale')}
          </button>
        ))}
      </div>

      <div className={styles.grid} role="radiogroup" aria-label={t('hairstyleRadioGroupLabel')}>
        {list.map((style) => (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={selectedStyleId === style.id}
            className={`${styles.card} ${selectedStyleId === style.id ? styles.cardSelected : ''}`}
            onClick={() => setSelectedStyleId(style.id)}
          >
            <span className={styles.cardEmoji} aria-hidden="true">
              {style.emoji}
            </span>
            <span className={styles.cardName}>{tPresets(`${style.id}.name`)}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.generateButton}
        onClick={start}
        disabled={selectedStyleId === null}
      >
        {t('generateButton')}
      </button>
    </div>
  );
}
