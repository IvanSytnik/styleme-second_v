'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Wraps next-themes with our project defaults.
 *
 * - System preference by default.
 * - Theme stored as `data-theme` attribute on <html> (matches our token selectors).
 * - SSR-safe: next-themes injects a blocking inline script in <head> to prevent FOUC.
 *
 * Day 7 hotfix (v2): next-themes renders that inline script via
 * `React.createElement('script', ...)`. React 19 (surfaced by Next.js
 * 16.2's stricter dev warnings) flags ANY <script> tag rendered inside
 * a component -- a false positive here, since this is the documented
 * SSR FOUC-prevention pattern and the script genuinely runs correctly.
 * Confirmed as a known, unresolved upstream issue (next-themes hasn't
 * shipped a fix; maintainer inactive >1 year -- pacocoursey/next-themes
 * #385, #387; corroborated by shadcn-ui/ui#10104, heroui#6348).
 *
 * v1 of this fix wrapped the console.error override in a `useEffect`
 * inside the component -- WRONG: the warning fires synchronously during
 * React's commit phase (`completeWork`, reconciling the `<script>`
 * fiber), which happens BEFORE any `useEffect` in that same render can
 * run. `useEffect` only helps for warnings triggered by later
 * interactions, not ones fired during the initial/every commit.
 *
 * Fix: move the override to MODULE scope, so it executes once when
 * this file is first imported -- guaranteed before `NextThemesProvider`
 * ever renders, and stays in effect across Fast Refresh re-renders too
 * (module-level code doesn't re-run per component instance).
 *
 * Remove this filter once next-themes ships an official fix upstream.
 */
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Encountered a script tag while rendering React component')
  ) {
    return;
  }
  originalConsoleError(...args);
};

export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark']}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
