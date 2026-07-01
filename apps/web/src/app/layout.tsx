import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { AuthProvider, AuthTokenBridge } from '@/lib/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';

import './globals.css';

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AuthTokenBridge />
            <QueryProvider>
              {children}
              {/*
                Day 4 (ADR-007): sonner Toaster — single instance at root.
                richColors: maps toast.error/success/warning to semantic colors.
                closeButton: a11y — users can dismiss before auto-dismiss.
                position bottom-right: doesn't compete with sticky AppHeader (top)
                or fixed catalog footer (bottom-center).
              */}
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
      </body>
    </html>
  );
}
