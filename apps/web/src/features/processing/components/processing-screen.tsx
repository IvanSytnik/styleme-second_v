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
 * Kicks off the transform mutation on mount. Dispatches to the correct
 * api method based on `mode` from the store (Day 4). Invalidates the
 * generations infinite query on success so the History screen picks
 * up the new row (Day 5).
 */
export function ProcessingScreen(): React.ReactElement {
  const image = useAppStore((s) => s.image);
  const mode = useAppStore((s) => s.mode);
  const styleId = useAppStore((s) => s.selectedStyleId);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const referenceImage = useAppStore((s) => s.referenceImage);
  const setResult = useAppStore((s) => s.setResult);
  const setScreen = useAppStore((s) => s.setScreen);
  const queryClient = useQueryClient();

  const styleName: string | null = (() => {
    if (mode === 'preset' && styleId !== null) {
      return HAIRSTYLES_UI_BY_ID.get(styleId)?.name ?? null;
    }
    if (mode === 'custom' && customPrompt) {
      return customPrompt.length > 60
        ? `${customPrompt.slice(0, 57)}…`
        : customPrompt;
    }
    if (mode === 'reference') {
      return 'Reference photo';
    }
    return null;
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!image) throw new Error('Missing image');
      switch (mode) {
        case 'preset': {
          if (styleId === null) throw new Error('Missing style');
          return api.transformByStyleId(image.blob, styleId);
        }
        case 'custom': {
          if (!customPrompt) throw new Error('Missing prompt');
          return api.transformCustom(image.blob, customPrompt);
        }
        case 'reference': {
          if (!referenceImage) throw new Error('Missing reference image');
          return api.transformWithReference(image.blob, referenceImage.blob);
        }
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['balance'], data.balance);
      // Day 5: history now has one more row; invalidate so next open refetches.
      void queryClient.invalidateQueries({ queryKey: ['generations', 'infinite'] });
      setResult(data.resultImage, data.style);
    },
  });

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
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setScreen('catalog')}
            >
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
