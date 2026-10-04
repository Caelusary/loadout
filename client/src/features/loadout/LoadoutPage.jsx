import { MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Price } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { CATEGORIES, CATEGORY_SINGULAR } from '../../lib/constants.js';
import { formatMoney } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { tileSpecs } from '../catalog/ProductTile.jsx';
import { useProducts } from '../catalog/queries.js';
import { CATEGORY_MODELS } from '../home/categoryModels.js';

const KEY = 'loadout_builder_v1';

function readPicks() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return Object.fromEntries(
      Object.entries(stored).filter(([c, id]) => CATEGORIES.includes(c) && typeof id === 'string'),
    );
  } catch {
    return {};
  }
}

// Lists one category's products to choose from, with a quick name filter.
function Picker({ category, currentId, onPick, onClose }) {
  const ref = useRef(null);
  const [q, setQ] = useState('');
  const { data, isPending, isError, error, refetch } = useProducts({
    category,
    limit: 48,
    sort: 'price-asc',
  });
  const items = (data?.items ?? []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Choose a ${CATEGORY_SINGULAR[category].toLowerCase()}`}
      className="m-auto flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(46rem,calc(100vw-2rem))] flex-col rounded-panel border border-seam bg-plate p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-3 border-b border-seam p-4">
        <h2 className="wide text-lg font-bold">Choose a {CATEGORY_SINGULAR[category].toLowerCase()}</h2>
        <button
          type="button"
          onClick={() => ref.current.close()}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-control text-ink-2 hover:bg-raised hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="border-b border-seam p-4">
        <label className="relative block">
          <span className="sr-only">Filter by name</span>
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name"
            className="h-10 w-full rounded-control border border-edge bg-bg pr-3 pl-9 text-[15px] text-ink placeholder:text-ink-3/70 focus:border-accent-ink focus:outline-none focus:placeholder:text-transparent"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">Nothing matches &quot;{q}&quot;.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  disabled={p.stock === 0}
                  aria-pressed={p._id === currentId}
                  onClick={() => {
                    onPick(p);
                    ref.current.close();
                  }}
                  className="flex w-full items-center gap-3 rounded-panel border border-seam bg-bg p-2.5 text-left transition-colors hover:border-edge disabled:opacity-50 aria-pressed:border-accent-ink"
                >
                  <ProductImage
                    src={p.images?.[0]?.url}
                    alt=""
                    className="size-16 shrink-0 rounded-control"
                    size={160}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-medium">{p.name}</span>
                    <span className="truncate text-[12px] text-ink-3">
                      {tileSpecs(p).join(' · ') || p.seller?.sellerProfile?.shopName}
                    </span>
                    <span className="text-[13px]">
                      {p.stock === 0 ? (
                        <span className="text-bad">Sold out</span>
                      ) : (
                        <Price cents={p.priceCents} was={p.compareAtCents} tag={false} className="font-mono" />
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

function Slot({ category, product, loading, onChoose, onClear }) {
  const { icon: Icon } = CATEGORY_MODELS[category];
  return (
    <li className="flex flex-col rounded-panel border border-seam bg-plate">
      <div className="flex items-center gap-2 border-b border-seam px-4 py-2.5">
        <Icon size={16} className="text-accent-ink" />
        <span className="font-mono text-[12px] tracking-[0.06em] text-ink-3 uppercase">
          {CATEGORY_SINGULAR[category]}
        </span>
      </div>
      {loading ? (
        <Skeleton className="m-4 h-28" />
      ) : product ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Link to={`/p/${product.slug}`} className="group flex items-center gap-3">
            <ProductImage
              src={product.images?.[0]?.url}
              alt=""
              className="size-20 shrink-0 rounded-control"
              size={200}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 text-[15px] leading-snug font-medium group-hover:text-accent-ink">
                {product.name}
              </span>
              <span className="text-[12px] text-ink-3">{product.seller?.sellerProfile?.shopName}</span>
              <Price cents={product.priceCents} was={product.compareAtCents} className="font-mono text-[14px]" />
            </span>
          </Link>
          <div className="mt-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={onChoose}>
              Change
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onChoose}
          className="m-3 flex min-h-14 flex-1 items-center justify-center gap-2 rounded-control border border-dashed sm:m-4 sm:min-h-28 sm:flex-col border-seam text-sm text-ink-2 transition-colors hover:border-accent-ink hover:text-accent-ink"
        >
          <Plus size={20} />
          Choose a {CATEGORY_SINGULAR[category].toLowerCase()}
        </button>
      )}
    </li>
  );
}

// Build a whole desk setup one category at a time, then add it all to the cart in one go.
export default function LoadoutPage() {
  const { user, isAdmin } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [picks, setPicks] = useState(readPicks);
  const [picking, setPicking] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(picks));
    } catch {
      // Not persisted, but still works for this visit.
    }
  }, [picks]);

  const ids = Object.values(picks);
  const { data, isPending, isError, error, refetch } = useProducts(
    { ids: ids.join(',') },
    { enabled: ids.length > 0 },
  );
  const byId = useMemo(
    () => new Map((data?.items ?? []).filter((p) => p.isActive !== false).map((p) => [p._id, p])),
    [data],
  );
  const chosen = CATEGORIES.map((c) => picks[c] && byId.get(picks[c])).filter(Boolean);
  const inCart = new Set(cart.items.map((i) => i.productId));
  // Already-in-cart picks are left alone, so pressing the button twice doesn't double them up.
  const buyable = chosen.filter((p) => p.stock > 0 && p.seller?._id !== user?._id && !inCart.has(p._id));
  const subtotal = chosen.reduce((sum, p) => sum + p.priceCents, 0);
  const shops = new Set(chosen.map((p) => p.seller?._id)).size;

  const addAll = () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent('/loadout')}`);
    Promise.all(buyable.map((p) => cart.add(p._id, 1))).then((results) => {
      const n = results.filter(Boolean).length;
      if (n) toast.show(`${n} item${n === 1 ? '' : 's'} added to your cart`);
    });
  };

  return (
    <Page title="Build your loadout">
      <p className="-mt-4 mb-8 max-w-2xl text-[15px] text-ink-2">
        Pick one of each and see the whole desk at a glance. Your picks are saved on this device.
      </p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Slot
                key={c}
                category={c}
                product={picks[c] ? byId.get(picks[c]) : null}
                loading={Boolean(picks[c]) && isPending}
                onChoose={() => setPicking(c)}
                onClear={() =>
                  setPicks((prev) => {
                    const next = { ...prev };
                    delete next[c];
                    return next;
                  })
                }
              />
            ))}
          </ul>
        )}

        <aside
          id="loadout-summary"
          className="flex h-fit flex-col gap-4 rounded-panel border border-seam bg-plate p-5 lg:sticky lg:top-24"
        >
          <h2 className="wide text-lg font-bold">Your loadout</h2>
          {chosen.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing picked yet. Start with a keyboard.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {chosen.map((p) => (
                <li key={p._id} className="flex justify-between gap-3">
                  <span className="truncate text-ink-2">{p.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(p.priceCents)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between border-t border-seam pt-3">
            <span className="font-medium">Total</span>
            <span className="font-mono font-medium tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          <p className="text-[12px] text-ink-3">
            {CATEGORIES.length - chosen.length} of {CATEGORIES.length} slots open.
            {shops > 1 ? ` From ${shops} shops, so shipping is worked out per shop at checkout.` : ''}
          </p>
          {isAdmin ? (
            <p className="text-[13px] text-ink-3">Admin accounts can&apos;t shop.</p>
          ) : (
            <Button size="lg" className="w-full" disabled={user && buyable.length === 0} onClick={addAll}>
              {!user
                ? 'Sign in to add to cart'
                : buyable.length
                  ? `Add ${buyable.length} to cart`
                  : 'Add to cart'}
            </Button>
          )}
          {user && chosen.length > buyable.length && (
            <p className="text-[12px] text-warn">
              {chosen.length - buyable.length} pick{chosen.length - buyable.length === 1 ? ' is' : 's are'}{' '}
              skipped: already in your cart, sold out, or from your own shop.
            </p>
          )}
          {chosen.length > 0 && (
            <button
              type="button"
              onClick={() => setPicks({})}
              className="text-[13px] text-ink-3 hover:text-ink"
            >
              Clear loadout
            </button>
          )}
        </aside>
      </div>

      {/* Phones and tablets: the total and the button stay within reach while scrolling the slots. */}
      {chosen.length > 0 && !isAdmin && <div className="h-20 lg:hidden" aria-hidden="true" />}
      {chosen.length > 0 && !isAdmin && (
        <div className="fixed inset-x-0 bottom-[var(--dock)] z-30 flex items-center justify-between gap-4 border-t border-seam bg-plate/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <a href="#loadout-summary" className="flex min-w-0 flex-col">
            <span className="text-[12px] text-ink-3">
              {chosen.length} of {CATEGORIES.length} picked
            </span>
            <span className="font-mono font-medium text-ink tabular-nums">{formatMoney(subtotal)}</span>
          </a>
          <Button disabled={user && buyable.length === 0} onClick={addAll}>
            {!user ? 'Sign in to add' : buyable.length ? `Add ${buyable.length} to cart` : 'Add to cart'}
          </Button>
        </div>
      )}

      {picking && (
        <Picker
          category={picking}
          currentId={picks[picking]}
          onPick={(p) => setPicks((prev) => ({ ...prev, [picking]: p._id }))}
          onClose={() => setPicking(null)}
        />
      )}
    </Page>
  );
}
