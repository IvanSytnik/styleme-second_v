'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ApiClientError } from './api-client';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Hairstyle catalog is static — cache it aggressively.
        staleTime: 5 * 60 * 1000, // 5 min
        gcTime: 30 * 60 * 1000,   // 30 min
        retry: (failureCount, error) => {
          // Don't retry user errors (4xx). Retry network / 5xx up to 2 times.
          if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Singleton on the client, fresh per request on the server.
 * Mirrors the pattern recommended in the TanStack Query Next.js guide.
 */
let browserQueryClient: QueryClient | undefined;
function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [queryClient] = useState(() => getQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
