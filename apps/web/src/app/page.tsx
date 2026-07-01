'use client';

import { useAppStore } from '@/lib/app-store';
import { CatalogScreen } from '@/features/catalog/components/catalog-screen';
import { ProcessingScreen } from '@/features/processing/components/processing-screen';
import { ResultScreen } from '@/features/result/components/result-screen';
import { UploadScreen } from '@/features/upload/components/upload-screen';

import { AppHeader } from './_components/app-header';
import styles from './page.module.css';

/**
 * Main flow router.
 *
 * Screens are switched via the Zustand store (`screen`) rather than URL —
 * Day 3 ships as a single-page flow. URL routing (so users can deep-link
 * to /upload, /catalog, /result/:id) can come in a later iteration if needed.
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
      </main>
    </>
  );
}
