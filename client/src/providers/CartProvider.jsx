import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { cartReducer } from '../lib/cart.js';
import { useAuth } from './AuthProvider.jsx';
import { useToast } from './ToastProvider.jsx';

// Like Shopee and Lazada, only signed-in shoppers have a cart, and it's saved on the account (/api/cart),
// so it's the same on every device. Changes show at once and are undone, with the server's reason, if
// the server refuses them (sold out, not listed, your own product).
const CartContext = createContext(null);
const MUTATION_KEY = ['cart-change'];

// Which items are unticked for checkout, per account, on this device. Only unticked ones are kept, so
// anything newly added starts ticked.
const uncheckedKey = (userId) => `loadout_cart_unchecked:${userId}`;
function readUnchecked(userId) {
  try {
    return new Set(userId ? JSON.parse(localStorage.getItem(uncheckedKey(userId)) ?? '[]') : []);
  } catch {
    return new Set();
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const enabled = Boolean(user) && !['admin', 'rider'].includes(user.role);
  const queryKey = useMemo(() => ['cart', user?._id], [user?._id]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => api('/cart', { signal }).then((r) => r.items),
    enabled,
  });

  // Carts used to live in this browser; clear those leftovers once.
  useEffect(() => {
    try {
      for (const k of Object.keys(localStorage))
        if (k.startsWith('loadout_cart_v2:')) localStorage.removeItem(k);
    } catch {
      // storage unavailable; nothing to clean
    }
  }, []);

  // Reloaded from storage when the account changes (set during render, React's pattern for state tied to a prop).
  const [ticks, setTicks] = useState(() => ({ userId: user?._id, unchecked: readUnchecked(user?._id) }));
  if (ticks.userId !== user?._id) setTicks({ userId: user?._id, unchecked: readUnchecked(user?._id) });
  const { unchecked } = ticks;
  const setUnchecked = (update) => setTicks((t) => ({ ...t, unchecked: update(t.unchecked) }));
  // Saved without items that have since left the cart, once the server's copy is in.
  useEffect(() => {
    if (!ticks.userId) return;
    const present = query.isSuccess ? new Set(query.data.map((i) => i.productId)) : null;
    try {
      localStorage.setItem(uncheckedKey(ticks.userId), JSON.stringify([...ticks.unchecked].filter((id) => !present || present.has(id))));
    } catch {
      // storage unavailable: the ticks just won't survive a reload
    }
  }, [ticks, query.isSuccess, query.data]);

  const pending = useIsMutating({ mutationKey: MUTATION_KEY });
  const { mutateAsync } = useMutation({
    mutationKey: MUTATION_KEY,
    // One change at a time, in the order they were made.
    scope: { id: 'cart' },
    mutationFn: ({ method, productId, qty, acknowledgePrice }) =>
      api(productId ? `/cart/${productId}` : '/cart', {
        method,
        ...(qty !== undefined && { body: { qty, ...(acknowledgePrice && { acknowledgePrice }) } }),
      }),
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (items = []) => cartReducer(items, action));
      return { previous };
    },
    onError: (err, _vars, context) => {
      // The snapshot predates any change queued behind this one, so restoring it would briefly wipe
      // those. Leave it to the last change in line: it restores, then reloads the server's copy, which
      // also corrects anything an earlier failure skipped.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1) {
        queryClient.setQueryData(queryKey, context?.previous);
        queryClient.invalidateQueries({ queryKey });
      }
      toast.error(err.fields?.qty ?? err.message);
    },
    onSuccess: (res) => {
      // Take the server's copy unless more changes are still queued behind this one.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1)
        queryClient.setQueryData(queryKey, res.items);
    },
  });

  // Each change resolves to whether the server accepted it, so callers only confirm what really saved.
  // (mutateAsync gives every call its own promise; per-call mutate callbacks only fire for the latest.)
  const change = useMemo(
    () => (vars) =>
      mutateAsync(vars).then(
        () => true,
        () => false,
      ),
    [mutateAsync],
  );

  const value = useMemo(() => {
    const items = enabled ? (query.data ?? []) : [];
    const selected = items.filter((i) => !unchecked.has(i.productId));
    return {
      items,
      // The ticked items: what the cart page totals and checkout buys.
      selected,
      isChecked: (productId) => !unchecked.has(productId),
      setChecked: (productId, checked) =>
        setUnchecked((prev) => {
          const next = new Set(prev);
          if (checked) next.delete(productId);
          else next.add(productId);
          return next;
        }),
      setAllChecked: (checked) => setUnchecked(() => (checked ? new Set() : new Set(items.map((i) => i.productId)))),
      enabled,
      // False until this account's cart has loaded.
      ready: !enabled || query.isSuccess || query.isError,
      error: query.error,
      refetch: query.refetch,
      saving: pending > 0,
      count: items.reduce((sum, i) => sum + i.qty, 0),
      add: (productId, qty = 1) =>
        change({ method: 'POST', productId, qty, action: { type: 'add', productId, qty } }),
      setQty: (productId, qty) =>
        change({ method: 'PUT', productId, qty, action: { type: 'set', productId, qty } }),
      // Takes the current price as seen, which clears the cart's "price changed" note.
      acknowledgePrice: (productId, qty) =>
        change({ method: 'PUT', productId, qty, acknowledgePrice: true, action: { type: 'set', productId, qty } }),
      remove: (productId) => change({ method: 'DELETE', productId, action: { type: 'remove', productId } }),
      clear: () => change({ method: 'DELETE', action: { type: 'clear' } }),
      // After checkout the server has already taken the bought items out; show that without a round trip.
      // Unticked items stay in the cart.
      checkedOut: (bought) => {
        const gone = new Set(bought.map((i) => i.productId));
        queryClient.setQueryData(queryKey, (current = []) => current.filter((i) => !gone.has(i.productId)));
        queryClient.invalidateQueries({ queryKey });
      },
    };
  }, [
    enabled,
    query.data,
    query.isSuccess,
    query.isError,
    query.error,
    query.refetch,
    pending,
    change,
    queryClient,
    queryKey,
    unchecked,
  ]);

  return <CartContext value={value}>{children}</CartContext>;
}

export const useCart = () => use(CartContext);
