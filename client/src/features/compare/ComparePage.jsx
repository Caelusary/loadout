import { Link as LinkIcon, Plus, X } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Page } from '../../components/layout/Page.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Price, SwitchChip } from '../../components/ui/chips.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { CATEGORY_LABELS, MAX_COMPARE, SPEC_FIELDS } from '../../lib/constants.js';
import { formatSpec, SPEC_NAMES } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { useCompare } from '../../providers/CompareProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useProducts } from '../catalog/queries.js';

// Which way is better for each numeric row; rows not listed aren't ranked.
const BETTER = {
  priceCents: 'low',
  ratingAvg: 'high',
  weightGrams: 'low',
  pollingRateHz: 'high',
  dpiMax: 'high',
  batteryMah: 'high',
  fps: 'high',
};

function bestIndexes(values, direction) {
  const nums = values.map((v) => (typeof v === 'number' ? v : null));
  const present = nums.filter((v) => v !== null);
  if (!direction || present.length < 2 || new Set(present).size === 1) return new Set();
  const target = direction === 'low' ? Math.min(...present) : Math.max(...present);
  return new Set(nums.flatMap((v, i) => (v === target ? [i] : [])));
}

// The table fills the page: a fixed label column, and the products (plus the "add another" slot) share the rest
// evenly, each centred in its column with the photo capped, so the space is balanced rather than left on one side.
// On a narrow screen each column keeps at least MIN_COLUMN_W and the table scrolls sideways.
const LABEL_W = 152;
const MIN_COLUMN_W = 220;

function Row({ label, values, render, direction, slot }) {
  const best = bestIndexes(values, direction);
  const same = values.length > 1 && values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
  return (
    <tr className="border-t border-seam">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-bg py-3 pr-4 pl-5 text-left text-[13px] font-medium text-ink-3"
      >
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className={`px-3 py-3 text-center text-[14px] ${same ? 'text-ink-3' : 'text-ink'}`}>
          <span className="inline-flex items-center gap-2">
            {v === undefined || v === null ? <span className="text-ink-3">—</span> : render(v)}
            {best.has(i) && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-ink">
                Best
              </span>
            )}
          </span>
        </td>
      ))}
      {slot && <td aria-hidden="true" />}
    </tr>
  );
}

// The end of a comparison is a decision, so each column ends with the way to act on it. Guests are sent to sign in
// and come back; sold-out, own-shop and already-added products say why instead of offering a dead button.
function BuyCell({ product }) {
  const { user, canShop } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  if (user && !canShop) return null;
  const inCart = cart.items.some((i) => i.productId === product._id);
  const note = (text) => <p className="py-2 text-[13px] text-ink-3">{text}</p>;
  if (product.stock === 0) return note('Sold out');
  if (user && product.seller?._id === user._id) return note('Your listing');
  if (inCart)
    return (
      <ButtonLink to="/cart" variant="secondary" size="sm" className="w-full max-w-[200px]">
        In your cart
      </ButtonLink>
    );
  return (
    <Button
      variant="secondary"
      size="sm"
      className="w-full max-w-[200px]"
      onClick={() => {
        if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        cart.add(product._id, 1).then((ok) => ok && toast.show(`${product.name} added to your cart`));
      }}
    >
      {user ? 'Add to cart' : 'Sign in to add'}
    </Button>
  );
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const compare = useCompare();
  const toast = useToast();
  // A shared link carries its own ids; otherwise compare what's in the tray.
  const ids = (params.get('ids') ?? compare.items.map((p) => p._id).join(','))
    .split(',')
    .filter(Boolean)
    .slice(0, MAX_COMPARE);
  const { data, isPending, isError, error, refetch } = useProducts(
    { ids: ids.join(','), limit: MAX_COMPARE },
    { enabled: ids.length > 0 },
  );
  // Unlisted products come back as stubs; leave them out.
  const products = ids
    .map((id) => data?.items.find((p) => p._id === id))
    .filter((p) => p && p.isActive !== false);

  // Keep the URL in step with the tray, so the address bar is always a shareable link.
  useEffect(() => {
    if (!params.get('ids') && ids.length) setParams({ ids: ids.join(',') }, { replace: true });
  }, [params, ids, setParams]);

  const removeAt = (id) => {
    compare.remove(id);
    const next = ids.filter((x) => x !== id);
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true });
  };

  if (ids.length === 0) {
    return (
      <Page title="Compare">
        <EmptyState
          title="Pick products to compare"
          action={<ButtonLink to="/shop">Browse products</ButtonLink>}
        >
          Use the compare button on any product. You can line up to three from the same category.
        </EmptyState>
      </Page>
    );
  }
  if (isError)
    return (
      <Page title="Compare">
        <ErrorState error={error} onRetry={refetch} />
      </Page>
    );

  const category = products[0]?.category;
  const specKeys = (SPEC_FIELDS[category] ?? []).filter((k) =>
    products.some((p) => p.specs?.[k] !== undefined),
  );
  // One "add another" column while there's room, linking to the category; it replaces a line of text under the table.
  const slot = !isPending && products.length < MAX_COMPARE && Boolean(category);
  const minWidth = LABEL_W + ((isPending ? ids.length : products.length) + (slot ? 1 : 0)) * MIN_COLUMN_W;
  // The category key is already the singular name (mousepad, accessory).
  const one = category;

  return (
    <Page title={category ? `Compare ${CATEGORY_LABELS[category].toLowerCase()}` : 'Compare'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Differences are in full colour; rows where every product matches are dimmed.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            navigator.clipboard
              .writeText(window.location.href)
              .then(() => toast.show('Link copied'))
              .catch(() => toast.error("Couldn't copy. Copy the address bar instead."))
          }
        >
          <LinkIcon size={15} /> Copy link
        </Button>
      </div>

      <div className="overflow-x-auto rounded-panel border border-seam bg-bg">
        {/* Fixed layout gives every product column the same width, so the images line up. */}
        <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-bg" style={{ width: LABEL_W }} />
              {(isPending ? ids : products).map((p, i) => (
                <th key={p._id ?? i} scope="col" className="px-3 pt-4 pb-3 text-center align-top font-normal">
                  {isPending ? (
                    <Skeleton className="mx-auto aspect-square w-full max-w-[280px]" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-full max-w-[280px]">
                        <ProductImage
                          src={p.images?.[0]?.url}
                          alt=""
                          className="aspect-square rounded-control"
                          size={320}
                        />
                        <button
                          type="button"
                          onClick={() => removeAt(p._id)}
                          aria-label={`Remove ${p.name} from comparison`}
                          className="absolute top-2 right-2 grid size-7 place-items-center rounded-full border border-seam bg-plate/90 text-ink-2 hover:text-ink"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </div>
                      <p className="text-[12px] text-ink-3">{p.seller?.sellerProfile?.shopName}</p>
                      <Link
                        to={`/p/${p.slug}`}
                        data-cursor-skip
                        className="text-[15px] font-medium text-ink hover:text-accent-ink"
                      >
                        {p.name}
                      </Link>
                    </div>
                  )}
                </th>
              ))}
              {slot && (
                <th scope="col" className="px-3 pt-4 pb-3 align-top font-normal">
                  {/* Opens the shop in picking mode: tapping a product adds it here and comes straight back. */}
                  <Link
                    to={`/shop?category=${category}&pick=compare`}
                    onClick={() => compare.replace(products)}
                    className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-control border-2 border-dashed border-seam text-ink-3 transition-colors hover:border-accent-ink hover:text-accent-ink"
                  >
                    <span className="flex flex-col items-center gap-2 text-[13px]">
                      <Plus size={22} />
                      Add another {one}
                    </span>
                  </Link>
                  <p className="mt-2 text-[12px] text-ink-3">Up to {MAX_COMPARE - products.length} more</p>
                </th>
              )}
            </tr>
          </thead>
          {!isPending && (
            <tbody>
              <Row
                slot={slot}
                label="Price"
                values={products.map((p) => p.priceCents)}
                direction={BETTER.priceCents}
                render={(v) => <Price cents={v} className="font-mono" />}
              />
              <Row
                slot={slot}
                label="Rating"
                values={products.map((p) => (p.ratingCount ? p.ratingAvg : null))}
                direction={BETTER.ratingAvg}
                render={(v) => <RatingDisplay value={v} />}
              />
              <Row
                slot={slot}
                label="Stock"
                values={products.map((p) => p.stock)}
                render={(v) => (v === 0 ? <span className="text-bad">Sold out</span> : `${v} left`)}
              />
              {specKeys.map((key) => (
                <Row
                  slot={slot}
                  key={key}
                  label={SPEC_NAMES[key] ?? key}
                  values={products.map((p) => p.specs?.[key])}
                  direction={BETTER[key]}
                  render={(v) => (key === 'switchType' ? <SwitchChip type={v} /> : formatSpec(key, v))}
                />
              ))}
              <tr className="border-t border-seam">
                <th scope="row" className="sticky left-0 z-10 bg-bg py-4 pr-4 pl-5">
                  <span className="sr-only">Buy</span>
                </th>
                {products.map((p) => (
                  <td key={p._id} className="px-3 py-4 text-center">
                    <BuyCell product={p} />
                  </td>
                ))}
                {slot && <td aria-hidden="true" />}
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </Page>
  );
}
