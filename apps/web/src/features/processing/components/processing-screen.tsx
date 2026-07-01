'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { HAIRSTYLES_UI_BY_ID } from '@styleme/shared';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { describeError } from '@/lib/error-messages';

import styles from './processing-screen.module.css';

/**
 * Processing screen.
 *
 * Kicks off the transform mutation immediately on mount. While Replicate is
 * busy (10–30s typical) we show an animated indeterminate progress band —
 * NO fake percentage. Day 6 will swap this for real polling progress.
 *
 * On success → result screen via app store.
 * On error → friendly message + back/retry actions.
 */
export function ProcessingScreen(): React.ReactElement {
  const image = useAppStore((s) => s.image);
  const styleId = useAppStore((s) => s.selectedStyleId);
  const setResult = useAppStore((s) => s.setResult);
  const setScreen = useAppStore((s) => s.setScreen);
  const queryClient = useQueryClient();

  const styleName = styleId !== null ? HAIRSTYLES_UI_BY_ID.get(styleId)?.name : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!image || styleId === null) throw new Error('Missing image or style');
      return api.transformByStyleId(image.blob, styleId);
    },
    onSuccess: (data) => {
      // Update cached balance with the post-transform snapshot from the API.
      queryClient.setQueryData(['balance'], data.balance);
      setResult(data.resultImage, data.style);
    },
  });

  // Auto-start the mutation once on mount. React 19 strict mode double-invokes
  // effects in dev, so we guard with a ref-equivalent via the mutation's own state.
  useEffect(() => {
    if (mutation.isIdle) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mutation.isError) {
    const err = describeError(mutation.error);
    return (
      <div className={styles.screen}>
        <div className={styles.errorBox}>
          <h2 className={styles.errorTitle}>{err.title}</h2>
          <p className={styles.errorBody}>{err.body}</p>
          <div className={styles.errorActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setScreen('catalog')}>
              ← Back
            </button>
            {err.retryable && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => mutation.mutate()}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.preview}>
        {image && <img src={image.previewUrl} alt="Your photo" />}
        <div className={styles.shimmer} aria-hidden="true" />
      </div>
      <h2 className={styles.title}>Creating your new look</h2>
      {styleName && <p className={styles.subtitle}>{styleName}</p>}
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} aria-hidden="true" />
      </div>
      <p className={styles.hint}>Usually takes 15–30 seconds…</p>
    </div>
  );
}
