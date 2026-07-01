'use client';

import { useMemo, useState } from 'react';

import { FEMALE_HAIRSTYLES, MALE_HAIRSTYLES, type Gender, type HairstyleListItem } from '@styleme/shared';

import { useAppStore } from '@/lib/app-store';

import styles from './catalog-screen.module.css';

/**
 * Catalog screen.
 * - Tabs for gender (female / male)
 * - Grid of styles with emoji + name
 * - Footer pinned with: back, photo preview, "Generate" CTA
 *
 * The list is sourced from `@styleme/shared` UI catalog — no network call.
 */
export function CatalogScreen(): React.ReactElement {
  const image = useAppStore((s) => s.image);
  const selectedStyleId = useAppStore((s) => s.selectedStyleId);
  const setSelectedStyleId = useAppStore((s) => s.setSelectedStyleId);
  const setScreen = useAppStore((s) => s.setScreen);

  const [gender, setGender] = useState<Gender>('female');

  const list: readonly HairstyleListItem[] = useMemo(
    () => (gender === 'female' ? FEMALE_HAIRSTYLES : MALE_HAIRSTYLES),
    [gender],
  );

  function start(): void {
    if (selectedStyleId === null) return;
    setScreen('processing');
  }

  return (
    <div className={styles.screen}>
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

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => setScreen('upload')}
          aria-label="Choose a different photo"
        >
          ← Photo
        </button>

        {image && (
          <div className={styles.photoPreview} aria-hidden="true">
            <img src={image.previewUrl} alt="" />
          </div>
        )}

        <button
          type="button"
          className={styles.primaryButton}
          onClick={start}
          disabled={selectedStyleId === null}
        >
          Generate ✨
        </button>
      </footer>
    </div>
  );
}
