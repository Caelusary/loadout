import { Link as LinkIcon, X } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Page } from '../../components/layout/Page.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Price, SwitchChip } from '../../components/ui/chips.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { CATEGORY_LABELS, SPEC_FIELDS } from '../../lib/constants.js';
import { formatSpec, SPEC_NAMES } from '../../lib/format.js';
import { useCompare } from '../../providers/CompareProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useProducts } from '../catalog/queries.js';

// Which way is better for each numeric row; rows not listed aren't ranked.
const BETTER = { priceCents: 'low', ratingAvg: 'high', weightGrams: 'low', pollingRateHz: 'high', dpiMax: 'high', batteryMah: 'high', fps: 'high' };

function bestIndexes(values, direction) {
  const nums = values.map((v) => (typeof v === 'number' ? v : null));
  const present = nums.filter((v) => v !== null);
  if (!direction || present.length < 2 || new Set(present).size === 1) return new Set();
  const target = direction === 'low' ? Math.min(...present) : Math.max(...present);
  return new Set(nums.flatMap((v, i) => (v === target ? [i] : [])));
}

function Row({ label, values, render, direction }) {
  const best = bestIndexes(values, direction);
  const same = values.length > 1 && values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]));
  return (
    <tr className="border-t border-seam">
      <th scope="row" className="sticky left-0 z-10 bg-bg py-3 pr-4 text-left text-[13px] font-medium text-ink-3">
        {label}
      </th>
      {values.map((v, i) => (
        <td key={i} className={`px-3 py-3 text-[14px] ${same ? 'text-ink-3' : 'text-ink'}`}>
          <span className="inline-flex items-center gap-2">
            {v === undefined || v === null ? <span className="text-ink-3">—</span> : render(v)}
            {best.has(i) && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-ink">Best</span>}
          </span>
        </td>
      ))}
    </tr>
  );
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const compare = useCompare();
  const toast = useToast();
  // A shared link carries its own ids; otherwise compare what's in the tray.
  const ids = (params.get('ids') ?? compare.items.map((p) => p._id).join(',')).split(',').filter(Boolean).slice(0, 4);
  const { data, isPending, isError, error, refetch } = useProducts({ ids: ids.join(','), limit: 4 }, { enabled: ids.length > 0 });
  // Unlisted products come back as stubs; leave them out.
  const products = ids.map((id) => data?.items.find((p) => p._id === id)).filter((p) => p && p.isActive !== false);

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
        <EmptyState title="Pick products to compare" action={<ButtonLink to="/shop">Browse products</ButtonLink>}>
          Use the compare button on any product. You can line up to four from the same category.
        </EmptyState>
      </Page>
    );
  }
  if (isError) return <Page title="Compare"><ErrorState error={error} onRetry={refetch} /></Page>;

  const category = products[0]?.category;
  const specKeys = (SPEC_FIELDS[category] ?? []).filter((k) => products.some((p) => p.specs?.[k] !== undefined));

  return (
    <Page title={category ? `Compare ${CATEGORY_LABELS[category].toLowerCase()}` : 'Compare'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">Differences are in full colour; rows where every product matches are dimmed.</p>
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
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-36 bg-bg" />
              {(isPending ? ids : products).map((p, i) => (
                <th key={p._id ?? i} scope="col" className="px-3 pt-4 pb-3 text-left align-top font-normal">
                  {isPending ? (
                    <Skeleton className="aspect-square w-full" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <ProductImage src={p.images?.[0]?.url} alt="" className="aspect-square rounded-control" size={320} />
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
                      <Link to={`/p/${p.slug}`} className="text-[15px] font-medium text-ink hover:text-accent-ink">
                        {p.name}
                      </Link>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {!isPending && (
            <tbody>
              <Row label="Price" values={products.map((p) => p.priceCents)} direction={BETTER.priceCents} render={(v) => <Price cents={v} className="font-mono" />} />
              <Row
                label="Rating"
                values={products.map((p) => (p.ratingCount ? p.ratingAvg : null))}
                direction={BETTER.ratingAvg}
                render={(v) => <RatingDisplay value={v} />}
              />
              <Row label="Stock" values={products.map((p) => p.stock)} render={(v) => (v === 0 ? <span className="text-bad">Sold out</span> : `${v} left`)} />
              {specKeys.map((key) => (
                <Row
                  key={key}
                  label={SPEC_NAMES[key] ?? key}
                  values={products.map((p) => p.specs?.[key])}
                  direction={BETTER[key]}
                  render={(v) => (key === 'switchType' ? <SwitchChip type={v} /> : formatSpec(key, v))}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
      {!isPending && products.length < 4 && (
        <p className="mt-4 text-[13px] text-ink-3">
          Add up to {4 - products.length} more from{' '}
          <Link to={`/shop?category=${category}`} className="text-accent-ink hover:underline">
            {CATEGORY_LABELS[category]?.toLowerCase() ?? 'the shop'}
          </Link>
          .
        </p>
      )}
    </Page>
  );
}
