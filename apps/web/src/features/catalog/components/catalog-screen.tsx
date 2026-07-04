'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAppStore } from '@/lib/app-store';

import { CustomPromptView } from './custom-prompt-view';
import { GalleryView } from './gallery-view';
import { ModeSelector, type CatalogMode } from './mode-selector';
import { ReferencePhotoView } from './reference-photo-view';

import styles from './catalog-screen.module.css';

/**
 * Catalog screen — Day 4 (ADR-007) two-tier layout.
 *
 * Top tier: mode selector (gallery / describe / reference) — input modality.
 * Lower tier (only inside gallery): gender tabs — content category.
 *
 * The old Day 3 catalog jammed Women/Men next to Custom/Reference in one
 * row, which mixes axes. This split keeps "how I choose" separate from
 * "what I'm choosing among" and scales cleanly when we add Trending/Saved.
 *
 * Day 7: back-button label + aria-label moved to i18n (`catalog.*`).
 */
export function CatalogScreen(): React.ReactElement {
  const t = useTranslations('catalog');
  const image = useAppStore((s) => s.image);
  const setScreen = useAppStore((s) => s.setScreen);
  const [mode, setMode] = useState<CatalogMode>('gallery');

  return (
    <div className={styles.screen}>
      <ModeSelector value={mode} onChange={setMode} />

      <div className={styles.body}>
        {mode === 'gallery' && <GalleryView />}
        {mode === 'custom' && <CustomPromptView />}
        {mode === 'reference' && <ReferencePhotoView />}
      </div>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => setScreen('upload')}
          aria-label={t('backToPhotoAriaLabel')}
        >
          {t('backToPhoto')}
        </button>

        {image && (
          <div className={styles.photoPreview} aria-hidden="true">
            <img src={image.previewUrl} alt="" />
          </div>
        )}

        {/* Right slot intentionally left blank — each view owns its own
            primary CTA (Generate / Try this style / Try this hairstyle). */}
        <span className={styles.footerSpacer} aria-hidden="true" />
      </footer>
    </div>
  );
}
