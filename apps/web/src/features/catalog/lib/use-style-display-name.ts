'use client';

import { useTranslations } from 'next-intl';

import { HAIRSTYLES_UI_BY_ID, type GenerationMode } from '@styleme/shared';

interface Args {
  mode: GenerationMode | null;
  styleId: number | null;
  customPrompt: string | null;
}

const CUSTOM_PROMPT_TRUNCATE_LENGTH = 60;
const CUSTOM_PROMPT_TRUNCATE_SLICE = 57;

/**
 * Single source of truth for "what do we call this generation" in the
 * UI (Day 7, ADR-010 / D3).
 *
 * Used identically by ProcessingScreen (before the server responds) and
 * ResultScreen (after) — both read `mode` / `selectedStyleId` /
 * `customPrompt` from the same Zustand store fields, which are only
 * cleared by `reset()` (explicit user action), never automatically
 * between the processing → result transition. See app-store.ts.
 *
 * NEVER resolves from `TransformResult.style` / `Generation.styleName`
 * — those are server-side debug labels only, not translated.
 */
export function useStyleDisplayName({ mode, styleId, customPrompt }: Args): string | null {
  const t = useTranslations('catalog.hairstyle.presets');
  const tReference = useTranslations('catalog.reference');

  if (mode === 'preset' && styleId !== null && HAIRSTYLES_UI_BY_ID.has(styleId)) {
    return t(`${styleId}.name`);
  }
  if (mode === 'custom' && customPrompt) {
    return customPrompt.length > CUSTOM_PROMPT_TRUNCATE_LENGTH
      ? `${customPrompt.slice(0, CUSTOM_PROMPT_TRUNCATE_SLICE)}…`
      : customPrompt;
  }
  if (mode === 'reference') {
    return tReference('resultLabel');
  }
  return null;
}
