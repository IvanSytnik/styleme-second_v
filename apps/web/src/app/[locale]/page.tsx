'use client';

import { useAppStore } from '@/lib/app-store';
import { CatalogScreen } from '@/features/catalog/components/catalog-screen';
import { HistoryDetailScreen } from '@/features/history/components/history-detail-screen';
import { HistoryScreen } from '@/features/history/components/history-screen';
import { ProcessingScreen } from '@/features/processing/components/processing-screen';
import { ResultScreen } from '@/features/result/components/result-screen';
import { UploadScreen } from '@/features/upload/components/upload-screen';

import { AppHeader } from '../_components/app-header';
import styles from '../page.module.css';

/**
 * Main flow router.
 *
 * Screens are switched via the Zustand store (`screen`). URL routing for
 * individual screens is a future iteration (Day 9+) — the `[locale]`
 * segment introduced in Day 7 only carries the language, not the screen.
 *
 * Day 5 (ADR-008): + history + history-detail screens.
 * Day 7: moved from `app/page.tsx` to `app/[locale]/page.tsx` (ADR-010 / D1).
 * `_components/app-header.tsx` and `page.module.css` stay at the old
 * `app/` level — they are not locale-specific files, just imported with
 * an updated relative path.
 */
export default function HomePage(): React.ReactElement {
  const screen = useAppStore((s) => s.screen);

  return (
    <>
      <AppHeader />
      <main className={styles.main}>
        {screen === 'upload' && <UploadScreen />}
        {screen === 'catalog' && <CatalogScreen />}
        {screen === 'processing' && <ProcessingScreen />}
        {screen === 'result' && <ResultScreen />}
        {screen === 'history' && <HistoryScreen />}
        {screen === 'history-detail' && <HistoryDetailScreen />}
      </main>
    </>
  );
}
