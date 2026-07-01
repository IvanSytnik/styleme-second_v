import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

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
            <QueryProvider>{children}</QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
