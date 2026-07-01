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
 * Day 4 (ADR-007): dispatches to one of three api methods based on the
 * `mode` set by the catalog view. Same mutation, same error UI — only
 * the network call and the `styleName` shown differ.
 *
 * On success → result screen via app store.
 * On error → friendly message + back/retry actions.
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

  // Compute the display label per mode
  const styleName: string | null = (() => {
    if (mode === 'preset' && styleId !== null) {
      return HAIRSTYLES_UI_BY_ID.get(styleId)?.name ?? null;
    }
    if (mode === 'custom' && customPrompt) {
      // Truncate long prompts for the subtitle
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
