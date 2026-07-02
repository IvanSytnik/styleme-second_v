'use client';

import { toast } from 'sonner';

import type { Generation } from '@styleme/shared';

import { useAppStore } from '@/lib/app-store';

/**
 * Regenerate helper (Day 5, ADR-008).
 *
 * We deliberately DO NOT persist the user's original photo. Regenerate
 * therefore cannot be one-click — it needs a fresh selfie.
 *
 * Flow:
 *   1. Pre-load the store with the past generation's mode + params.
 *   2. Also pre-clear reference image (never persisted).
 *   3. Navigate to the upload screen.
 *   4. Toast a nudge so the user understands why they land there.
 *
 * When they upload a photo, the upload screen already navigates to catalog
 * on success. Because we've pre-set selectedStyleId (for preset) or
 * customPrompt (for custom), the catalog's Generate button is one tap away.
 *
 * For reference mode we can't restore the reference photo either (also
 * not persisted). The catalog opens in reference mode with an empty
 * dropzone — user re-uploads both photos. Toast makes this explicit.
 */
export function useRegenerate(): (g: Generation) => void {
  const setScreen = useAppStore((s) => s.setScreen);
  const setMode = useAppStore((s) => s.setMode);
  const setSelectedStyleId = useAppStore((s) => s.setSelectedStyleId);
  const setCustomPrompt = useAppStore((s) => s.setCustomPrompt);
  const setReferenceImage = useAppStore((s) => s.setReferenceImage);

  return (g: Generation) => {
    setMode(g.mode);
    setSelectedStyleId(g.mode === 'preset' ? g.styleId : null);
    setCustomPrompt(g.mode === 'custom' ? g.customPrompt : null);
    setReferenceImage(null);

    switch (g.mode) {
      case 'preset':
        toast.info(`Upload a photo to try "${g.styleName}" again.`);
        break;
      case 'custom':
        toast.info('Upload a photo to try that description again.');
        break;
      case 'reference':
        toast.info('Upload a photo and pick a reference to try again.');
        break;
    }

    setScreen('upload');
  };
}
