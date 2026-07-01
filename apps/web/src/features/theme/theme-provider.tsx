'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Wraps next-themes with our project defaults.
 *
 * - System preference by default.
 * - Theme stored as `data-theme` attribute on <html> (matches our token selectors).
 * - SSR-safe: next-themes injects a blocking inline script in <head> to prevent FOUC.
 */
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
