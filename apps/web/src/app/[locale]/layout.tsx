import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { Toaster } from 'sonner';

import { AuthProvider, AuthTokenBridge } from '@/lib/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { routing } from '@/i18n/routing';

import '../globals.css';

export const metadata: Metadata = {
  title: 'StyleMe — AI Hairstyle Try-On',
  description: 'Upload a photo and try on 40+ hairstyles with AI.',
  applicationName: 'StyleMe',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Day 7 (ADR-010 / D1): this file replaces the old `app/layout.tsx`.
 * The old file MUST be deleted, not left in place — Next resolves
 * `app/page.tsx` and `app/[locale]/page.tsx` as two different route
 * trees and a leftover would keep serving stale English-only UI at `/`
 * while this one only serves under the (as-needed) prefix. See
 * START_HERE.md smoke checklist.
 */
export default async function LocaleLayout({ children, params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <AuthProvider>
              <AuthTokenBridge />
              <QueryProvider>
                {children}
                <Toaster
                  position="bottom-right"
                  richColors
                  closeButton
                  theme="system"
                  toastOptions={{ duration: 5000 }}
                />
              </QueryProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
