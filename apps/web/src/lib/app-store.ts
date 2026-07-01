/**
 * Global app state for the generation flow.
 *
 * Lives outside React Query because it tracks UI navigation between screens,
 * not server-derived data. Server state (catalog, balance, transform result)
 * stays in React Query.
 *
 * Day 4 (ADR-007): extended with `mode` + custom prompt + reference image
 * to drive three transform variants (preset / custom / reference) through
 * the same processing screen.
 */

'use client';

import { create } from 'zustand';

export type Screen = 'upload' | 'catalog' | 'processing' | 'result';

/**
 * Which transform pipeline the processing screen should run.
 * - `preset` uses selectedStyleId
 * - `custom` uses customPrompt
 * - `reference` uses referenceImage
 */
export type TransformMode = 'preset' | 'custom' | 'reference';

export interface UploadedImage {
  /** Original File from the user, preserved so we can re-process if needed. */
  file: File;
  /** Object URL for preview rendering. Caller must revoke. */
  previewUrl: string;
  /** Resized JPEG ready for upload. */
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Reference image is a lighter struct than UploadedImage — we only need
 * a blob for the API call and a preview URL for the pre-generate confirmation.
 */
export interface ReferenceImage {
  previewUrl: string;
  blob: Blob;
}

interface AppState {
  screen: Screen;
  image: UploadedImage | null;

  /** Which pipeline to run. Set by catalog view immediately before setScreen('processing'). */
  mode: TransformMode;

  /** Preset mode. */
  selectedStyleId: number | null;

  /** Custom mode. Trimmed to schema bounds by the form before assignment. */
  customPrompt: string | null;

  /** Reference mode. */
  referenceImage: ReferenceImage | null;

  resultUrl: string | null;
  resultStyleName: string | null;

  setScreen: (screen: Screen) => void;
  setImage: (image: UploadedImage | null) => void;

  setMode: (mode: TransformMode) => void;
  setSelectedStyleId: (id: number | null) => void;
  setCustomPrompt: (prompt: string | null) => void;
  setReferenceImage: (ref: ReferenceImage | null) => void;

  setResult: (url: string, styleName: string) => void;
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
  resultStyleName: null,

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

  setResult: (resultUrl, resultStyleName) =>
    set({ resultUrl, resultStyleName, screen: 'result' }),

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
      resultStyleName: null,
    });
  },
}));
