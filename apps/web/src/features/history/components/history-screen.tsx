'use client';

import { useEffect, useRef } from 'react';

import { useAppStore } from '@/lib/app-store';

import { useGenerations } from '../api/use-generations';

import { HistoryCard } from './history-card';

import styles from './history-screen.module.css';

/**
 * History screen (Day 5, ADR-008).
 *
 * IntersectionObserver-driven pagination: when the sentinel div at the end
 * of the grid enters the viewport, we fetchNextPage. Single-observer
 * pattern — no manual scroll listeners, no throttling headaches.
 */
export function HistoryScreen(): React.ReactElement {
  const setScreen = useAppStore((s) => s.setScreen);
  const setDetailGenerationId = useAppStore((s) => s.setDetailGenerationId);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useGenerations();

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      // Kick fetch a bit before the sentinel enters — avoids visible blank space
      { rootMargin: '256px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const openDetail = (id: string): void => {
    setDetailGenerationId(id);
    setScreen('history-detail');
  };

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // ---------- Loading (first page) ----------
  if (isPending) {
    return (
      <section className={styles.screen} aria-busy="true">
        <header className={styles.header}>
          <h2 className={styles.title}>History</h2>
        </header>
        <div className={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeleton} aria-hidden="true" />
          ))}
        </div>
      </section>
    );
  }

  // ---------- Error ----------
  if (isError) {
    return (
      <section className={styles.screen}>
        <header className={styles.header}>
          <h2 className={styles.title}>History</h2>
        </header>
        <div className={styles.errorBox}>
          <p>Could not load your history.</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  // ---------- Empty ----------
  if (items.length === 0) {
    return (
      <section className={styles.screen}>
        <header className={styles.header}>
          <h2 className={styles.title}>History</h2>
        </header>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            🕘
          </span>
          <h3 className={styles.emptyTitle}>No generations yet</h3>
          <p className={styles.emptyBody}>
            Upload a photo and try a hairstyle — it&apos;ll appear here.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setScreen('upload')}
          >
            Try your first hairstyle ✨
          </button>
        </div>
      </section>
    );
  }

  // ---------- Populated ----------
  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <h2 className={styles.title}>History</h2>
        <span className={styles.count} aria-live="polite">
          {items.length}
          {hasNextPage ? '+' : ''}
        </span>
      </header>

      <div className={styles.grid} role="list">
        {items.map((g) => (
          <div key={g.id} role="listitem">
            <HistoryCard generation={g} onOpen={openDetail} />
          </div>
        ))}
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      {isFetchingNextPage && (
        <p className={styles.loadingMore} aria-live="polite">
          Loading more…
        </p>
      )}

      {!hasNextPage && (
        <p className={styles.end} aria-live="polite">
          You&apos;ve seen everything.
        </p>
      )}
    </section>
  );
}
