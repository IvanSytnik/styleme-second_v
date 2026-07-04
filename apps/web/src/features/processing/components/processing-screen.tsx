'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/app-store';
import { describeError } from '@/lib/error-messages';
import { useStyleDisplayName } from '@/features/catalog/lib/use-style-display-name';

import styles from './processing-screen.module.css';

/**
 * Processing screen.
 *
 * Kicks off the transform mutation on mount. Dispatches to the correct
 * api method based on `mode` from the store (Day 4). Invalidates the
 * generations infinite query on success so the History screen picks
 * up the new row (Day 5).
 *
 * Day 7 (ADR-010): style subtitle now resolved via `useStyleDisplayName`
 * (shared with ResultScreen) instead of a local IIFE reading
 * `HAIRSTYLES_UI_BY_ID.get(id)?.name` -- that field no longer exists.
 *
 * Day 7 hotfix #7 (post-i18n bug report): fixed a real production bug
 * -- confirmed in dev logs -- where TWO full `/api/transform` requests
 * fired for a single generation, consuming two credits and calling
 * Replicate twice. Root cause: React Strict Mode (on by default in
 * Next.js App Router dev) intentionally double-invokes effects on
 * mount to help surface exactly this class of bug. The old guard,
 * `if (mutation.isIdle) mutation.mutate()`, is NOT sufficient: 
 * `useMutation`'s `status` updates asynchronously (via TanStack
 * Query's own internal state, not synchronously on `.mutate()` call),
 * so Strict Mode's second, synchronous effect invocation still sees
 * a closure where `mutation.isIdle` reads `true` -- the first call's
 * status transition to `pending` hasn't propagated yet. Both
 * invocations pass the guard and both fire a real `mutate()`.
 *
 * Fix: a `useRef` boolean guard. Refs are mutable and survive Strict
 * Mode's double effect invocation (the component instance itself is
 * not remounted between the two calls, only the effect body runs
 * twice) -- so the ref reliably blocks the second invocation
 * regardless of async mutation state. This is the standard React
 * pattern for "this side effect must run exactly once" (the
 * pre-hooks equivalent was a `didMountRef` on class components).
 *
 * This does NOT protect against every possible double-fire scenario
 * (e.g. two browser tabs, or a client retry after a dropped response)
 * -- true idempotency for those cases would need a client-generated
 * request ID deduplicated server-side. Tracked as a Future Improvement,
 * intentionally not bundled into this fix (different problem: this
 * fix is a React lifecycle bug, that would be an API-contract change).
 */
export function ProcessingScreen(): React.ReactElement {
  const t = useTranslations('processing');
  const tErrors = useTranslations('errors');
  const image = useAppStore((s) => s.image);
  const mode = useAppStore((s) => s.mode);
  const styleId = useAppStore((s) => s.selectedStyleId);
  const customPrompt = useAppStore((s) => s.customPrompt);
  const referenceImage = useAppStore((s) => s.referenceImage);
  const setResult = useAppStore((s) => s.setResult);
  const setScreen = useAppStore((s) => s.setScreen);
  const queryClient = useQueryClient();

  const styleName = useStyleDisplayName({ mode, styleId, customPrompt });

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
      // Day 7: `data.style` is a server debug label — NOT stored for
      // display. ResultScreen re-derives the display name itself via
      // useStyleDisplayName from the same store fields we already have.
      setResult(data.resultImage);
    },
  });

  // Hotfix #7: guards against Strict Mode's double effect invocation on
  // mount firing two real mutations. See file header for full analysis.
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mutation.isError) {
    const err = describeError(mutation.error, tErrors);
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
              {t('backButton')}
            </button>
            {err.retryable && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => mutation.mutate()}
              >
                {t('tryAgainButton')}
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
        {image && <img src={image.previewUrl} alt={t('photoAlt')} />}
        <div className={styles.shimmer} aria-hidden="true" />
      </div>
      <h2 className={styles.title}>{t('title')}</h2>
      {styleName && <p className={styles.subtitle}>{styleName}</p>}
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} aria-hidden="true" />
      </div>
      <p className={styles.hint}>{t('hint')}</p>
    </div>
  );
}
