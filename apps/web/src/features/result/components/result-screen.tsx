'use client';

import { useState } from 'react';

import { useAppStore } from '@/lib/app-store';

import styles from './result-screen.module.css';

/**
 * Result screen — side-by-side before/after.
 * Actions: download, share (Web Share API), try another, start over.
 */
export function ResultScreen(): React.ReactElement {
  const image = useAppStore((s) => s.image);
  const resultUrl = useAppStore((s) => s.resultUrl);
  const styleName = useAppStore((s) => s.resultStyleName);
  const setScreen = useAppStore((s) => s.setScreen);
  const reset = useAppStore((s) => s.reset);

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
          title: 'My new look with StyleMe',
          text: styleName ? `Tried "${styleName}" on StyleMe` : 'Tried a new hairstyle on StyleMe',
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
        <p>No result to show.</p>
        <button type="button" className={styles.primaryButton} onClick={reset}>
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h2 className={styles.title}>Your new look</h2>
        {styleName && <p className={styles.subtitle}>{styleName}</p>}
      </header>

      <div className={styles.compare}>
        <figure className={styles.figure}>
          <img src={image?.previewUrl} alt="Before" />
          <figcaption className={styles.caption}>Before</figcaption>
        </figure>
        <figure className={styles.figure}>
          <img src={resultUrl} alt="After" />
          <figcaption className={`${styles.caption} ${styles.captionAfter}`}>After</figcaption>
        </figure>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={handleShare}>
          {shareState === 'copied' ? '✓ Link copied' : shareState === 'sharing' ? 'Sharing…' : 'Share'}
        </button>
        <button type="button" className={styles.primaryButton} onClick={handleDownload}>
          Download ⬇
        </button>
      </div>

      <div className={styles.secondaryActions}>
        <button type="button" className={styles.linkButton} onClick={() => setScreen('catalog')}>
          Try another style
        </button>
        <button type="button" className={styles.linkButton} onClick={reset}>
          Use another photo
        </button>
      </div>
    </div>
  );
}
