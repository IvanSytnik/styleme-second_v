'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import type { GenerationListPage } from '@styleme/shared';

import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-provider';

/** Server default is 20; kept in sync here for consistent staleness math. */
export const HISTORY_PAGE_SIZE = 20;

/**
 * Infinite-scroll generations feed.
 *
 * Keys:
 *   ['generations', 'infinite']
 *
 * We do NOT include userId in the queryKey — the JWT bearer is bound to
 * the current session; when auth changes the entire QueryClient should
 * reset (handled globally in AuthTokenBridge).
 */
export function useGenerations() {
  const { isReady } = useAuth();

  return useInfiniteQuery<GenerationListPage>({
    queryKey: ['generations', 'infinite'],
    enabled: isReady,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      api.listGenerations({
        cursor: pageParam as string | undefined,
        limit: HISTORY_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // History mutates slowly (only after a fresh transform). Loose staleness
    // is fine — freshness comes from targeted invalidation on transform +
    // delete mutations.
    staleTime: 60_000,
  });
}
