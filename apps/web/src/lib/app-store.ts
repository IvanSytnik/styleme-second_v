/**
 * Global app state for the generation flow.
 *
 * Lives outside React Query because it tracks UI navigation between screens,
 * not server-derived data. Server state (catalog, balance, transform result,
 * generation list) stays in React Query.
 *
 * Day 5 (ADR-008): + 'history' and 'history-detail' screens.
 * `detailGenerationId` carries which row to show when in history-detail.
 * The row itself lives in React Query cache (avoid duplicating server state).
 *
 * Day 7 (ADR-010 / D3): `resultStyleName` REMOVED. It used to store the
 * server's `TransformResult.style`, which is now a debug-only English
 * label, never shown in the UI. ResultScreen instead calls
 * `useStyleDisplayName({ mode, styleId, customPrompt })` — the same
 * store fields already read by ProcessingScreen. This is safe because
 * `mode` / `selectedStyleId` / `customPrompt` are only cleared by
 * `reset()`, which is an explicit user action (never fired automatically
 * on the processing → result transition) — see setResult below.
 */

'use client';

import { create } from 'zustand';

export type Screen =
  | 'upload'
  | 'catalog'
  | 'processing'
  | 'result'
  | 'history'
  | 'history-detail';

export type TransformMode = 'preset' | 'custom' | 'reference';

export interface UploadedImage {
  file: File;
  previewUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface ReferenceImage {
  previewUrl: string;
  blob: Blob;
}

interface AppState {
  screen: Screen;
  image: UploadedImage | null;
  mode: TransformMode;
  selectedStyleId: number | null;
  customPrompt: string | null;
  referenceImage: ReferenceImage | null;
  resultUrl: string | null;

  /** Day 5: which generation to render on the history-detail screen. */
  detailGenerationId: string | null;

  setScreen: (screen: Screen) => void;
  setImage: (image: UploadedImage | null) => void;

  setMode: (mode: TransformMode) => void;
  setSelectedStyleId: (id: number | null) => void;
  setCustomPrompt: (prompt: string | null) => void;
  setReferenceImage: (ref: ReferenceImage | null) => void;

  setResult: (url: string) => void;
  setDetailGenerationId: (id: string | null) => void;

  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'upload',
  image: null,
  mode: 'preset',
  selectedStyleId: null,
  customPrompt: null,
  referenceImage: null,
  resultUrl: null,
  detailGenerationId: null,

  setScreen: (screen) => set({ screen }),

  setImage: (image) => {
    const prev = get().image;
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    set({ image });
  },

  setMode: (mode) => set({ mode }),

  setSelectedStyleId: (selectedStyleId) => set({ selectedStyleId }),

  setCustomPrompt: (customPrompt) => set({ customPrompt }),

  setReferenceImage: (referenceImage) => {
    const prev = get().referenceImage;
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    set({ referenceImage });
  },

  setResult: (resultUrl) => set({ resultUrl, screen: 'result' }),

  setDetailGenerationId: (detailGenerationId) => set({ detailGenerationId }),

  reset: () => {
    const prevImage = get().image;
    if (prevImage?.previewUrl) URL.revokeObjectURL(prevImage.previewUrl);
    const prevRef = get().referenceImage;
    if (prevRef?.previewUrl) URL.revokeObjectURL(prevRef.previewUrl);
    set({
      screen: 'upload',
      image: null,
      mode: 'preset',
      selectedStyleId: null,
      customPrompt: null,
      referenceImage: null,
      resultUrl: null,
      detailGenerationId: null,
    });
  },
}));
