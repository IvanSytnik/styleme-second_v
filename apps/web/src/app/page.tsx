'use client';

import { useAppStore } from '@/lib/app-store';
import { CatalogScreen } from '@/features/catalog/components/catalog-screen';
import { HistoryDetailScreen } from '@/features/history/components/history-detail-screen';
import { HistoryScreen } from '@/features/history/components/history-screen';
import { ProcessingScreen } from '@/features/processing/components/processing-screen';
import { ResultScreen } from '@/features/result/components/result-screen';
import { UploadScreen } from '@/features/upload/components/upload-screen';

import { AppHeader } from './_components/app-header';
import styles from './page.module.css';

/**
 * Main flow router.
 *
 * Screens are switched via the Zustand store (`screen`). URL routing is
 * a future iteration (Day 9+).
 *
 * Day 5 (ADR-008): + history + history-detail screens.
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
