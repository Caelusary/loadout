import { FadersHorizontal, X } from '@phosphor-icons/react';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { CATEGORIES, CATEGORY_LABELS } from '../../lib/constants.js';
import { CategoryStrip } from './CategoryStrip.jsx';
import { Filters } from './Filters.jsx';
import { ProductGrid } from './ProductTile.jsx';
import { useProducts } from './queries.js';

const FILTER_KEYS = ['q', 'category', 'brand', 'switchType', 'connectivity', 'layout', 'resolution', 'minPrice', 'maxPrice', 'inStock', 'onSale'];
const SORTS = [
  ['newest', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Top rated'],
];

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  // A search lists best matches first unless another order is picked (the server's default for a search).
  const searching = Boolean(params.get('q'));
  const defaultSort = searching ? 'relevance' : 'newest';
  const sorts = searching ? [['relevance', 'Best match'], ...SORTS] : SORTS;
  const sheet = useRef(null);
  const category = params.get('category');
  const q = params.get('q');
  const title = q ? `Results for "${q}"` : (CATEGORY_LABELS[category] ?? 'All products');
  useTitle(title);

  const query = Object.fromEntries([...FILTER_KEYS, 'sort', 'page'].map((k) => [k, params.get(k) ?? undefined]));
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(query);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const activeFilters = FILTER_KEYS.filter((k) => k !== 'q' && params.get(k)).length;
  const clearAll = () => setParams(q ? { q } : {});

  const filters = <Filters params={params} brands={data?.brands} onChange={update} />;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        {CATEGORIES.includes(category) && !q ? (
          <CategoryStrip category={category} total={data?.total} params={params} onChange={update} />
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="wide text-[28px] leading-tight font-bold sm:text-[32px]">{title}</h1>
            <p className="font-mono text-[13px] text-ink-3 tabular-nums" aria-live="polite">
              {data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => sheet.current?.showModal()}>
            <FadersHorizontal size={16} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={params.get('sort') ?? defaultSort}
            onChange={(e) => update({ sort: e.target.value === defaultSort ? '' : e.target.value })}
            className="h-9 rounded-control border border-seam bg-raised px-3 text-[13px] text-ink hover:border-edge focus:border-accent-ink focus:outline-none"
          >
            {sorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label="Filters">
          {filters}
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={clearAll}>
              Clear filters
            </Button>
          )}
        </aside>

        <section aria-busy={isPending || isPlaceholderData} className={isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          {isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : !isPending && data.items.length === 0 && data.suggestion ? (
            <EmptyState title={`No results for "${q}"`}>
              Did you mean{' '}
              <button
                type="button"
                className="font-medium text-accent-ink underline underline-offset-2 hover:no-underline"
                onClick={() => update({ q: data.suggestion })}
              >
                {data.suggestion}
              </button>
              ?
            </EmptyState>
          ) : !isPending && data.items.length === 0 ? (
            <EmptyState
              title="Nothing matches these filters"
              action={
                <Button variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            >
              Try a different switch type or widen the price range.
            </EmptyState>
          ) : (
            <>
              <ProductGrid products={data?.items ?? []} loading={isPending} />
              {data && <Pagination page={data.page} pages={data.pages} onPage={(page) => update({ page: String(page) })} />}
            </>
          )}
          {data?.related?.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-14 border-t border-seam pt-8">
              <h2 id="related-heading" className="wide mb-1 text-lg font-bold text-ink">
                Related
              </h2>
              <p className="mb-6 text-sm text-ink-3">Close to &quot;{q}&quot;, but not an exact match.</p>
              <ProductGrid products={data.related} />
            </section>
          )}
        </section>
      </div>

      <dialog
        ref={sheet}
        className="mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-panel border-t border-seam bg-plate p-0 text-ink lg:hidden"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-seam bg-plate px-4 py-3">
          <h2 className="wide text-lg font-bold">Filters</h2>
          <button
            type="button"
            onClick={() => sheet.current?.close()}
            aria-label="Close filters"
            className="grid size-10 place-items-center rounded-control text-ink-2 hover:bg-raised"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-5">{filters}</div>
        <div className="sticky bottom-0 flex gap-2 border-t border-seam bg-plate px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="secondary" className="flex-1" onClick={clearAll}>
            Clear
          </Button>
          <Button className="flex-1" onClick={() => sheet.current?.close()}>
            Show {data?.total ?? ''} results
          </Button>
        </div>
      </dialog>
    </div>
  );
}
