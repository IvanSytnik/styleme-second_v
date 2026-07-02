'use client';

import type { Generation } from '@styleme/shared';

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
 */
export function HistoryCard({ generation: g, onOpen }: Props): React.ReactElement {
  const label =
    g.mode === 'custom'
      ? g.customPrompt ?? 'Custom style'
      : g.styleName;

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
        <span className={styles.date}>{relativeTime(g.createdAt)}</span>
      </div>
      <button
        type="button"
        className={styles.openButton}
        onClick={() => onOpen(g.id)}
        aria-label={`Open generation: ${label}, created ${relativeTime(g.createdAt)}`}
      />
    </article>
  );
}
