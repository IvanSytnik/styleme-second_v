'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  LIMITS,
  transformCustomSchema,
  type TransformCustomInput,
} from '@styleme/shared';

import { useAppStore } from '@/lib/app-store';

import styles from './custom-prompt-view.module.css';

/**
 * Custom prompt view (Day 4).
 *
 * User writes a free-form hairstyle description. Client-side validation
 * mirrors the server schema exactly (`transformCustomSchema` is the single
 * source of truth). On submit → set customPrompt + mode + navigate to
 * processing, where the mutation dispatches to api.transformCustom.
 *
 * Day 7: label/help/submit/placeholders moved to i18n
 * (`catalog.customPrompt.*`). Placeholders are locale-specific example
 * hairstyle descriptions, not just translated UI chrome — kept as an
 * array in the dictionary (`t.raw`) so each locale can offer culturally
 * natural examples rather than a literal translation of the English set.
 */
export function CustomPromptView(): React.ReactElement {
  const t = useTranslations('catalog.customPrompt');
  const setCustomPrompt = useAppStore((s) => s.setCustomPrompt);
  const setMode = useAppStore((s) => s.setMode);
  const setScreen = useAppStore((s) => s.setScreen);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<TransformCustomInput>({
    resolver: zodResolver(transformCustomSchema),
    mode: 'onChange',
    defaultValues: { hairstyle: '' },
  });

  const hairstyle = watch('hairstyle') ?? '';
  const length = hairstyle.length;

  // t.raw returns the untranslated array as-is; safe here because it's
  // sourced from our own JSON dictionaries, not user input.
  const placeholders = t.raw('placeholders') as string[];
  // Pick once per mount, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placeholder = useMemo(
    () => placeholders[Math.floor(Math.random() * placeholders.length)],
    [],
  );

  const onSubmit = handleSubmit((data) => {
    // trim to match server-side schema (which does .trim() before .min())
    const trimmed = data.hairstyle.trim();
    setCustomPrompt(trimmed);
    setMode('custom');
    setScreen('processing');
  });

  const counterDanger = length > LIMITS.MAX_CUSTOM_PROMPT_LENGTH;
  const counterWarning =
    length > LIMITS.MAX_CUSTOM_PROMPT_LENGTH * 0.9 && !counterDanger;

  return (
    <form onSubmit={onSubmit} className={styles.root}>
      <label htmlFor="custom-prompt" className={styles.label}>
        {t('label')}
      </label>

      <textarea
        id="custom-prompt"
        {...register('hairstyle')}
        className={styles.textarea}
        placeholder={placeholder}
        rows={4}
        aria-invalid={!!errors.hairstyle}
        aria-describedby="custom-prompt-help custom-prompt-counter"
        maxLength={LIMITS.MAX_CUSTOM_PROMPT_LENGTH + 50}
      />

      <div className={styles.meta}>
        <span id="custom-prompt-help" className={styles.help}>
          {errors.hairstyle?.message ?? t('help')}
        </span>
        <span
          id="custom-prompt-counter"
          className={`${styles.counter} ${counterDanger ? styles.counterDanger : ''} ${counterWarning ? styles.counterWarning : ''}`}
          aria-live="polite"
        >
          {length} / {LIMITS.MAX_CUSTOM_PROMPT_LENGTH}
        </span>
      </div>

      <button type="submit" className={styles.submit} disabled={!isValid}>
        {t('submit')}
      </button>
    </form>
  );
}
