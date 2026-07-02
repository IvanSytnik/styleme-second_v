'use client';

import { useMemo, useState } from 'react';

import type { Generation } from '@styleme/shared';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { useAppStore } from '@/lib/app-store';

import { useDeleteGeneration } from '../api/use-delete-generation';
import type { GenerationListPage } from '@styleme/shared';
import { useRegenerate } from '../lib/regenerate';
import { relativeTime } from '../lib/relative-time';

import styles from './history-detail-screen.module.css';

/**
 * HistoryDetailScreen (Day 5, ADR-008).
 *
 * Reads the target generation directly from the React Query cache —
 * infinite-query pages are already there when we come from the list.
 * If cache is cold (rare — e.g. deep link once URL routing lands),
 * we fall back to a "not found" state.
 *
 * Actions: Regenerate, Download, Share (Web Share API), Delete.
 */
export function HistoryDetailScreen(): React.ReactElement {
  const id = useAppStore((s) => s.detailGenerationId);
  const setScreen = useAppStore((s) => s.setScreen);
  const setDetailGenerationId = useAppStore((s) => s.setDetailGenerationId);
  const qc = useQueryClient();

  const generation = useMemo<Generation | null>(() => {
    if (!id) return null;
    const data =
      qc.getQueryData<InfiniteData<GenerationListPage>>(['generations', 'infinite']);
    if (!data) return null;
    for (const page of data.pages) {
      const found = page.items.find((g) => g.id === id);
      if (found) return found;
    }
    return null;
  }, [id, qc]);

  const regenerate = useRegenerate();
  const del = useDeleteGeneration();

  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function goBack(): void {
    setDetailGenerationId(null);
    setScreen('history');
  }

  async function handleDownload(): Promise<void> {
    if (!generation) return;
    try {
      const res = await fetch(generation.resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `styleme-${(generation.styleName ?? 'result')
        .replace(/\s+/g, '-')
        .toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(generation.resultUrl, '_blank', 'noopener');
    }
  }

  async function handleShare(): Promise<void> {
    if (!generation) return;
    setShareState('sharing');
    try {
      const res = await fetch(generation.resultUrl);
      const blob = await res.blob();
      const file = new File([blob], 'styleme-result.jpg', {
        type: blob.type || 'image/jpeg',
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My look with StyleMe',
          text: `Tried "${generation.styleName}" on StyleMe`,
        });
        setShareState('idle');
        return;
      }
      await navigator.clipboard.writeText(generation.resultUrl);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('idle');
    }
  }

  function handleRegenerate(): void {
    if (!generation) return;
    regenerate(generation);
  }

  function handleDelete(): void {
    if (!generation) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    del.mutate(generation.id, {
      onSuccess: () => goBack(),
    });
  }

  if (!generation) {
    return (
      <section className={styles.screen}>
        <button type="button" className={styles.backButton} onClick={goBack}>
          ← Back
        </button>
        <p className={styles.notFound}>Generation not found.</p>
      </section>
    );
  }

  const displayName =
    generation.mode === 'custom'
      ? generation.customPrompt ?? 'Custom style'
      : generation.styleName;

  return (
    <section className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={goBack}>
          ← Back
        </button>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>{displayName}</h2>
          <p className={styles.subtitle}>
            <span className={styles.modeBadge}>{generation.mode}</span>
            <span>{relativeTime(generation.createdAt)}</span>
          </p>
        </div>
      </header>

      <div className={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={generation.resultUrl}
          alt={displayName}
          className={styles.image}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleRegenerate}
        >
          Regenerate ✨
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleDownload}
        >
          Download ⬇
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleShare}
        >
          {shareState === 'copied'
            ? '✓ Link copied'
            : shareState === 'sharing'
              ? 'Sharing…'
              : 'Share'}
        </button>
      </div>

      <div className={styles.dangerZone}>
        <button
          type="button"
          className={confirmDelete ? styles.dangerConfirm : styles.dangerButton}
          onClick={handleDelete}
          disabled={del.isPending}
          aria-live="polite"
        >
          {del.isPending
            ? 'Deleting…'
            : confirmDelete
              ? 'Tap again to confirm delete'
              : 'Delete'}
        </button>
        {confirmDelete && !del.isPending && (
          <button
            type="button"
            className={styles.dangerCancel}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
