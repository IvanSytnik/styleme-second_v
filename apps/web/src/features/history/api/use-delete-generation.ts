'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { GenerationListPage } from '@styleme/shared';

import { api, ApiClientError } from '@/lib/api-client';

interface DeleteContext {
  previous: InfiniteData<GenerationListPage> | undefined;
}

/**
 * Delete mutation with optimistic UI.
 *
 * onMutate  — remove the row from the cached pages so the UI updates instantly
 * onError   — restore the cache + toast the reason
 * onSettled — refetch the first page so any server-side reconciliation lands
 *
 * We only refetch the first page (not full refetch) — deletion never
 * changes ordering of earlier pages, only their size, and the cursor-based
 * pagination handles that transparently.
 */
export function useDeleteGeneration() {
  const qc = useQueryClient();
  const key = ['generations', 'infinite'] as const;

  return useMutation<{ deleted: true }, ApiClientError, string, DeleteContext>({
    mutationFn: (id: string) => api.deleteGeneration(id),

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<InfiniteData<GenerationListPage>>(key);

      if (previous) {
        qc.setQueryData<InfiniteData<GenerationListPage>>(key, {
          ...previous,
          pages: previous.pages.map((page) => ({
            ...page,
            items: page.items.filter((g) => g.id !== id),
          })),
        });
      }

      return { previous };
    },

    onError: (err, _id, ctx) => {
      // Roll back
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      const msg =
        err.code === 'NOT_FOUND'
          ? 'Generation was already deleted.'
          : 'Could not delete. Please try again.';
      toast.error(msg);
    },

    onSuccess: () => {
      toast.success('Generation deleted');
    },

    onSettled: () => {
      // Fire-and-forget refetch; UI already reflects the change.
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
