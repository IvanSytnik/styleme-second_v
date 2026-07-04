'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { Generation } from '@styleme/shared';

import { useStyleDisplayName } from '@/features/catalog/lib/use-style-display-name';

import { relativeTime } from '../lib/relative-time';

import styles from './history-card.module.css';

interface Props {
  generation: Generation;
  onOpen: (id: string) => void;
}

/**
 * Grid card.
 *
 * Semantics: <article> with an <img> and a <button> that opens the detail
 * view. The whole card is clickable via a full-cover button (Simon Hearne
 * pattern) which keeps a11y (button gets focus, keyboard, aria-label) and
 * lets the image + text be non-focusable decoration.
 *
 * Day 7 (ADR-010 / D3) FIX: this previously rendered `g.styleName`
 * directly for mode === 'preset' rows. Per ADR-010, `styleName` is a
 * server-side debug/analytics label (canonical English) — never a UI
 * display string. It went unnoticed in Wave 1 because History wasn't in
 * that pack's file set. Fixed here by reusing `useStyleDisplayName`
 * (the same resolver shared by ProcessingScreen/ResultScreen), fed with
 * `Generation.mode` / `styleId` / `customPrompt` — all already present
 * on the row, no new API surface needed.
 */
export function HistoryCard({ generation: g, onOpen }: Props): React.ReactElement {
  const t = useTranslations('history');
  const locale = useLocale();

  const resolvedName = useStyleDisplayName({
    mode: g.mode,
    styleId: g.styleId,
    customPrompt: g.customPrompt,
  });
  const label = resolvedName ?? t('customStyleFallback');
  const time = relativeTime(g.createdAt, locale);

  return (
    <article className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={g.resultUrl}
        alt=""
        className={styles.image}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.meta}>
        <span className={styles.name}>{label}</span>
        <span className={styles.date}>{time}</span>
      </div>
      <button
        type="button"
        className={styles.openButton}
        onClick={() => onOpen(g.id)}
        aria-label={t('openCardAriaLabel', { label, time })}
      />
    </article>
  );
}
