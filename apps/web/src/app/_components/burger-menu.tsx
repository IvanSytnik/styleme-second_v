'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { ThemeSwitcher } from '@/features/theme/components/theme-switcher';
import { LanguageSwitcher } from '@/features/theme/components/language-switcher';
import { WatchAdButton } from '@/features/rewards/components/watch-ad-button';

import styles from './burger-menu.module.css';

const DESKTOP_MEDIA_QUERY = '(min-width: 641px)';
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * SSR mount guard for the portal (Lesson 13), as a store rather than a
 * setState-in-effect: `false` on the server snapshot, `true` on the client,
 * with a no-op subscribe since the value never changes after hydration.
 * Avoids the cascading render `react-hooks/set-state-in-effect` flags.
 */
const NOOP_UNSUBSCRIBE = (): void => {};
const subscribeNever = (): (() => void) => NOOP_UNSUBSCRIBE;
const getMountedSnapshot = (): boolean => true;
const getMountedServerSnapshot = (): boolean => false;

interface Props {
  showHistoryButton: boolean;
  onOpenHistory: () => void;
  historyLabel: string;
  openHistoryAriaLabel: string;
}

/**
 * Mobile overflow menu (Day 9 Wave B, Lesson 30): collapses History /
 * WatchAd / Language / Theme into a burger drawer below 640px, matching
 * the breakpoint `.balance` already hides at (app-header.module.css).
 *
 * Desktop is untouched — AppHeader still renders those controls inline
 * above 640px; this component's trigger is CSS-hidden there.
 *
 * Deliberate trade-off: below 640px this renders a SECOND, independent
 * mount of WatchAdButton/LanguageSwitcher/ThemeSwitcher (the inline copies
 * in AppHeader are CSS-hidden, not unmounted). Chosen over a JS
 * matchMedia switch to avoid an SSR/hydration flash of the overflowing
 * desktop layout on first paint — exactly the bug this component fixes.
 * The one edge case this trades in: resizing the window across 640px
 * while the drawer is open would otherwise leave it open alongside the
 * now-visible desktop row, so we force-close on that transition below.
 *
 * Portal to document.body (Lesson 13): AppHeader has `backdrop-filter`,
 * which becomes a containing block for `position: fixed` descendants.
 * Pattern mirrors dev-ad-modal.tsx.
 */
export function BurgerMenu({
  showHistoryButton,
  onOpenHistory,
  historyLabel,
  openHistoryAriaLabel,
}: Props): React.ReactElement {
  const t = useTranslations('header');
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(subscribeNever, getMountedSnapshot, getMountedServerSnapshot);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Force-close if a live resize crosses back onto the desktop layout,
  // where the inline controls become visible again (see trade-off note).
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (e: MediaQueryListEvent): void => {
      if (e.matches) setOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls="header-drawer"
        aria-label={open ? t('closeMenuAriaLabel') : t('openMenuAriaLabel')}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <>
            <div className={styles.backdrop} role="presentation" onClick={() => setOpen(false)} />
            <div
              ref={panelRef}
              id="header-drawer"
              className={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-label={t('menuAriaLabel')}
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{t('menuAriaLabel')}</span>
                <button
                  type="button"
                  className={styles.closeButton}
                  aria-label={t('closeMenuAriaLabel')}
                  onClick={() => setOpen(false)}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <div className={styles.controls}>
                {showHistoryButton && (
                  <button
                    type="button"
                    className={styles.historyItem}
                    onClick={() => {
                      setOpen(false);
                      onOpenHistory();
                    }}
                    aria-label={openHistoryAriaLabel}
                  >
                    <span aria-hidden="true">🕘</span>
                    <span>{historyLabel}</span>
                  </button>
                )}
                <WatchAdButton />
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
