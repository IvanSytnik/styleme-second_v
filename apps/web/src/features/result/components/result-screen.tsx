'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useAppStore } from '@/lib/app-store';
import { useStyleDisplayName } from '@/features/catalog/lib/use-style-display-name';

import styles from './result-screen.module.css';

/**
 * Result screen — side-by-side before/after.
 * Actions: download, share (Web Share API), try another, start over.
 *
 * Day 7 (ADR-010 / D3): style name no longer comes from the store
 * (`resultStyleName` removed) — resolved via `useStyleDisplayName` from
 * the same `mode` / `selectedStyleId` / `customPrompt` fields
 * ProcessingScreen used to kick off this same generation. These fields
 * survive the processing → result transition (only `reset()` clears
 * them, and reset() is only called by explicit user actions below).
 */
export function ResultScreen(): React.ReactElement {
  const t = useTranslations('result');
  const image = useAppStore((s) => s.image);
  const resultUrl = useAppStore((s) => s.resultUrl);
  const mode = useAppStore((s) => s.mode);
  const styleId = useAppStore((s) => s.selectedStyleId);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const setScreen = useAppStore((s) => s.setScreen);
  const reset = useAppStore((s) => s.reset);

  const styleName = useStyleDisplayName({ mode, styleId, customPrompt });

  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');

  async function handleDownload(): Promise<void> {
    if (!resultUrl) return;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `styleme-${(styleName ?? 'result').replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(resultUrl, '_blank', 'noopener');
    }
  }

  async function handleShare(): Promise<void> {
    if (!resultUrl) return;
    setShareState('sharing');
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const file = new File([blob], 'styleme-result.jpg', { type: blob.type || 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t('shareTitle'),
          text: styleName ? t('shareTextWithStyle', { styleName }) : t('shareTextGeneric'),
        });
        setShareState('idle');
        return;
      }
      // Fallback: copy result URL
      await navigator.clipboard.writeText(resultUrl);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('idle');
    }
  }

  if (!resultUrl) {
    return (
      <div className={styles.screen}>
        <p>{t('noResult')}</p>
        <button type="button" className={styles.primaryButton} onClick={reset}>
          {t('startOver')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('title')}</h2>
        {styleName && <p className={styles.subtitle}>{styleName}</p>}
      </header>

      <div className={styles.compare}>
        <figure className={styles.figure}>
          <img src={image?.previewUrl} alt={t('beforeAlt')} />
          <figcaption className={styles.caption}>{t('before')}</figcaption>
        </figure>
        <figure className={styles.figure}>
          <img src={resultUrl} alt={t('afterAlt')} />
          <figcaption className={`${styles.caption} ${styles.captionAfter}`}>{t('after')}</figcaption>
        </figure>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={handleShare}>
          {shareState === 'copied' ? t('linkCopied') : shareState === 'sharing' ? t('sharing') : t('share')}
        </button>
        <button type="button" className={styles.primaryButton} onClick={handleDownload}>
          {t('download')}
        </button>
      </div>

      <div className={styles.secondaryActions}>
        <button type="button" className={styles.linkButton} onClick={() => setScreen('catalog')}>
          {t('tryAnotherStyle')}
        </button>
        <button type="button" className={styles.linkButton} onClick={reset}>
          {t('useAnotherPhoto')}
        </button>
      </div>
    </div>
  );
}
