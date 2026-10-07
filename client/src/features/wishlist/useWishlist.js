import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const KEY = ['wishlist'];

// Saved products for the signed-in shopper. Admins and guests have no wishlist.
export function useWishlist() {
  const { user, canShop } = useAuth();
  const enabled = Boolean(user) && canShop;
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api('/wishlist', { signal }),
    enabled,
    staleTime: 60_000,
  });
  const ids = useMemo(() => new Set(query.data?.ids ?? []), [query.data]);

  const mutation = useMutation({
    // One queue for all wishlist writes, so a fast double tap's PUT and DELETE reach the server in order.
    scope: { id: 'wishlist' },
    mutationFn: ({ productId, save }) => api(`/wishlist/${productId}`, { method: save ? 'PUT' : 'DELETE' }),
    // Flip the heart straight away; roll back if the server refuses.
    onMutate: async ({ productId, save }) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData(KEY);
      queryClient.setQueryData(KEY, (old = { items: [], ids: [] }) => ({
        items: save ? old.items : old.items.filter((p) => p._id !== productId),
        ids: save ? [...old.ids, productId] : old.ids.filter((id) => id !== productId),
      }));
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(KEY, context?.previous);
      toast.error(err.message);
    },
    // Refetch only after the last queued change, so an earlier refetch can't undo a later optimistic flip.
    onSettled: () => {
      const queued = queryClient.isMutating({ predicate: (m) => m.options.scope?.id === 'wishlist' });
      if (queued <= 1) queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  return {
    enabled,
    items: query.data?.items ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    has: (productId) => ids.has(productId),
    toggle: (productId) => mutation.mutate({ productId, save: !ids.has(productId) }),
  };
}
