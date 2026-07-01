'use client';

import { useMemo, useState } from 'react';

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
 */
export function GalleryView(): React.ReactElement {
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
      <div className={styles.tabs} role="tablist" aria-label="Hairstyle category">
        {(['female', 'male'] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={gender === g}
            className={`${styles.tab} ${gender === g ? styles.tabActive : ''}`}
            onClick={() => setGender(g)}
          >
            {g === 'female' ? 'Women' : 'Men'}
          </button>
        ))}
      </div>

      <div className={styles.grid} role="radiogroup" aria-label="Hairstyle">
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
            <span className={styles.cardName}>{style.name}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.generateButton}
        onClick={start}
        disabled={selectedStyleId === null}
      >
        Generate ✨
      </button>
    </div>
  );
}
