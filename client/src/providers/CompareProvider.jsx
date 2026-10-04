import { createContext, use, useEffect, useMemo, useState } from 'react';
import { CATEGORY_LABELS, MAX_COMPARE } from '../lib/constants.js';
import { useToast } from './ToastProvider.jsx';

const CompareContext = createContext(null);
const KEY = 'loadout_compare_v1';

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((p) => p?._id && p.category).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

// Just enough of a product to draw the tray without refetching.
const summary = (p) => ({ _id: p._id, slug: p.slug, name: p.name, category: p.category, image: p.images?.[0]?.url });

// Products picked for side-by-side comparison. Specs only line up within one category, so picking
// something from another category starts a new comparison.
export function CompareProvider({ children }) {
  const [items, setItems] = useState(read);
  const toast = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Not persisted, but still works for this visit.
    }
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      has: (id) => items.some((p) => p._id === id),
      toggle: (product) => {
        if (items.some((p) => p._id === product._id)) {
          setItems((list) => list.filter((p) => p._id !== product._id));
          return;
        }
        if (items.length && items[0].category !== product.category) {
          setItems([summary(product)]);
          const label = CATEGORY_LABELS[product.category]?.toLowerCase() ?? 'these';
          toast.show(`Comparing ${label} now. Comparisons stay within one category.`);
          return;
        }
        if (items.length >= MAX_COMPARE) {
          toast.error(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
          return;
        }
        // Functional update, so two quick taps in one render both land.
        setItems((list) => (list.some((p) => p._id === product._id) || list.length >= MAX_COMPARE ? list : [...list, summary(product)]));
      },
      remove: (id) => setItems((list) => list.filter((p) => p._id !== id)),
      clear: () => setItems([]),
    }),
    [items, toast],
  );

  return <CompareContext value={value}>{children}</CompareContext>;
}

export const useCompare = () => use(CompareContext);
