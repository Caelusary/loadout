import { createContext, use, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ConfirmDialog } from '../components/ui/Dialog.jsx';
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
const summary = (p) => ({
  _id: p._id,
  slug: p.slug,
  name: p.name,
  category: p.category,
  image: p.images?.[0]?.url,
});

// Products picked for side-by-side comparison. Specs only line up within one category, so picking
// something from another category starts a new comparison. Adding one from anywhere but that category's shop
// page (a product page, the wishlist, search) takes you there, so the alternatives are already in front of you.
export function CompareProvider({ children }) {
  const [items, setItems] = useState(read);
  const [switching, setSwitching] = useState(null); // a product from another category, waiting on a yes
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onCategoryPage = (category) =>
    pathname === '/shop' && new URLSearchParams(search).get('category') === category;
  const showAlternatives = (product, count) => {
    // A full comparison has nothing left to find; the tray's Compare button is the next step.
    if (count >= MAX_COMPARE || onCategoryPage(product.category)) return false;
    navigate(`/shop?category=${product.category}`);
    return true;
  };

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
        // Specs only line up within one category, so another category means starting over: ask first, since
        // the comparison being built would be thrown away.
        if (items.length && items[0].category !== product.category) {
          setSwitching(product);
          return;
        }
        if (items.length >= MAX_COMPARE) {
          toast.error(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
          return;
        }
        // Functional update, so two quick taps in one render both land.
        setItems((list) =>
          list.some((p) => p._id === product._id) || list.length >= MAX_COMPARE
            ? list
            : [...list, summary(product)],
        );
        if (showAlternatives(product, items.length + 1)) {
          const label = CATEGORY_LABELS[product.category]?.toLowerCase() ?? 'products';
          toast.show(`Added to compare. Pick more ${label} to line up against it.`);
        }
      },
      remove: (id) => setItems((list) => list.filter((p) => p._id !== id)),
      // Picking from the shop for an open comparison: adds without leaving the page (the picker goes back to it).
      add: (product) => {
        if (items.some((p) => p._id === product._id)) return true;
        if (items.length && items[0].category !== product.category) {
          toast.error('Pick one from the same category as the others.');
          return false;
        }
        if (items.length >= MAX_COMPARE) {
          toast.error(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
          return false;
        }
        setItems((list) => [...list, summary(product)]);
        return true;
      },
      // The compare page hands over what it's showing (it may be a shared link) before sending you to pick more.
      replace: (products) => setItems(products.slice(0, MAX_COMPARE).map(summary)),
      clear: () => setItems([]),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlternatives reads the current location
    [items, toast, pathname, search],
  );

  const from = CATEGORY_LABELS[items[0]?.category]?.toLowerCase() ?? 'products';
  const to = CATEGORY_LABELS[switching?.category]?.toLowerCase() ?? 'products';
  return (
    <CompareContext value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(switching)}
        title={`Compare ${to} instead?`}
        confirmLabel="Start a new comparison"
        cancelLabel={`Keep my ${from}`}
        tone="primary"
        onConfirm={() => {
          const product = switching;
          setSwitching(null);
          setItems([summary(product)]);
          if (showAlternatives(product, 1))
            toast.show(`Comparing ${to} now. Pick more to line up against it.`);
        }}
        onClose={() => setSwitching(null)}
      >
        Comparisons stay within one category, so this clears the {items.length} {from} you picked.
      </ConfirmDialog>
    </CompareContext>
  );
}

export const useCompare = () => use(CompareContext);
