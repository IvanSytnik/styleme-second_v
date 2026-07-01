/**
 * Global app state for the generation flow.
 *
 * Lives outside React Query because it tracks UI navigation between screens,
 * not server-derived data. Server state (catalog, balance, transform result)
 * stays in React Query.
 */

'use client';

import { create } from 'zustand';

export type Screen = 'upload' | 'catalog' | 'processing' | 'result';

interface UploadedImage {
  /** Original File from the user, preserved so we can re-process if needed. */
  file: File;
  /** Object URL for preview rendering. Caller must revoke. */
  previewUrl: string;
  /** Resized JPEG ready for upload. */
  blob: Blob;
  width: number;
  height: number;
}

interface AppState {
  screen: Screen;
  image: UploadedImage | null;
  selectedStyleId: number | null;
  resultUrl: string | null;
  resultStyleName: string | null;

  setScreen: (screen: Screen) => void;
  setImage: (image: UploadedImage | null) => void;
  setSelectedStyleId: (id: number | null) => void;
  setResult: (url: string, styleName: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'upload',
  image: null,
  selectedStyleId: null,
  resultUrl: null,
  resultStyleName: null,

  setScreen: (screen) => set({ screen }),
  setImage: (image) => {
    // Free the previous preview URL to prevent leaks.
    const prev = get().image;
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    set({ image });
  },
  setSelectedStyleId: (selectedStyleId) => set({ selectedStyleId }),
  setResult: (resultUrl, resultStyleName) => set({ resultUrl, resultStyleName, screen: 'result' }),
  reset: () => {
    const prev = get().image;
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    set({
      screen: 'upload',
      image: null,
      selectedStyleId: null,
      resultUrl: null,
      resultStyleName: null,
    });
  },
}));
