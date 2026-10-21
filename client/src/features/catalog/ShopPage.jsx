import { FadersHorizontal, Package, Tag, X } from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { CATEGORIES, CATEGORY_LABELS } from '../../lib/constants.js';
import { CategoryStrip } from './CategoryStrip.jsx';
import { FilterColumn } from './FilterColumn.jsx';
import { Filters } from './Filters.jsx';
import { ProductGrid } from './ProductTile.jsx';
import { PriceSlider } from './PriceSlider.jsx';
import { SortMenu } from './SortMenu.jsx';
import { SHOP_FILTER_KEYS as FILTER_KEYS, shopParams, useProducts } from './queries.js';

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

  const query = shopParams(params);
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(query);
  // Switching category fades the new products in. The key changes only once they've arrived, so the previous
  // category's list (shown dimmed while loading) doesn't fade in first.
  const [gridKey, setGridKey] = useState(category);
  if (data && !isPlaceholderData && gridKey !== category) setGridKey(category);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    // A new category reshapes the header (its blurb and quick filters), which would shove the toolbar down in one
    // frame; a view transition cross-fades the whole change instead.
    const newCategory = 'category' in changes && (changes.category || null) !== category;
    // (Done by hand: the app uses BrowserRouter, which doesn't run React Router's own view transitions.)
    if (newCategory && document.startViewTransition) {
      // The transition waits for a frame to snapshot the old page; if none comes (a background tab), the change
      // still lands after 300ms, and whichever runs second does nothing.
      let done = false;
      const run = () => {
        if (done) return;
        done = true;
        flushSync(() => setParams(next));
      };
      document.startViewTransition(run);
      setTimeout(run, 300);
    } else setParams(next);
  };
  // The search, the category being browsed and compare-picking are where you are, not filters on top: they don't
  // count toward Clear, and Clear keeps them (it used to drop "Shop keyboards" back to every product).
  const KEEP = ['q', 'category', 'pick'];
  const activeFilters = FILTER_KEYS.filter((k) => !KEEP.includes(k) && params.get(k)).length;
  const clearAll = () =>
    setParams(Object.fromEntries(KEEP.filter((k) => params.get(k)).map((k) => [k, params.get(k)])));
  const clearSearch = () => update({ q: '' });

  const filters = <Filters params={params} brands={data?.brands} onChange={update} />;

  const picking = params.get('pick') === 'compare';

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-10 sm:px-6">
      {/* Picking for an open comparison: say so, and offer the way back without adding anything. */}
      {picking && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-accent-ink/40 bg-accent/10 px-4 py-3">
          <p className="text-sm text-ink">Tap a {category ?? 'product'} to add it to your comparison.</p>
          <ButtonLink to="/compare" variant="secondary" size="sm">
            Back to comparison
          </ButtonLink>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        {CATEGORIES.includes(category) && !q ? (
          <CategoryStrip category={category} total={data?.total} />
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="wide text-[28px] leading-tight font-bold sm:text-[32px]">{title}</h1>
            <p className="font-mono text-[13px] text-ink-3 tabular-nums" aria-live="polite">
              {data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* The filters people reach for most sit with Sort, one tap away on every screen size. */}
          <PriceSlider
            min={params.get('minPrice') ?? ''}
            max={params.get('maxPrice') ?? ''}
            onChange={(minPrice, maxPrice) => update({ minPrice, maxPrice })}
          />
          <QuickToggle on={params.get('onSale') === '1'} onChange={(on) => update({ onSale: on ? '1' : '' })}>
            <Tag size={16} /> On sale
          </QuickToggle>
          <QuickToggle
            on={params.get('inStock') === '1'}
            onChange={(on) => update({ inStock: on ? '1' : '' })}
          >
            <Package size={16} /> In stock
          </QuickToggle>
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => sheet.current?.showModal()}
          >
            <FadersHorizontal size={16} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          <SortMenu
            sorts={sorts}
            value={params.get('sort') ?? defaultSort}
            onChange={(value) => update({ sort: value === defaultSort ? '' : value })}
          />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* The filter column scrolls on its own (it's pinned beside the products, so with every section open the last
            ones would otherwise be out of reach). Its header stays put above the scroll with Clear, which is greyed
            out until a filter is on and then says how many it clears. */}
        <FilterColumn
          header={
            <div className="flex shrink-0 items-center justify-between border-b border-seam py-2.5 pr-2.5 pl-4">
              <h2 className="text-[12px] font-medium tracking-[0.08em] text-ink-3 uppercase">Filters</h2>
              <ClearPill count={activeFilters} onClear={clearAll} />
            </div>
          }
        >
          {filters}
        </FilterColumn>

        <section
          aria-busy={isPending || isPlaceholderData}
          className={isPlaceholderData ? 'opacity-60 transition-opacity' : ''}
        >
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
          ) : !isPending && data.items.length === 0 && q && !activeFilters ? (
            // Only a search is narrowing this, so "Clear filters" would do nothing: offer to drop the search.
            <EmptyState
              title={`No results for "${q}"`}
              action={
                <Button variant="secondary" onClick={clearSearch}>
                  Clear search
                </Button>
              }
            >
              Try another name or brand, or browse {category ? 'the whole category' : 'everything'} instead.
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
              {/* Says what "cheap" or "sale" in the search did, so a short list doesn't look like missing stock. */}
              {data?.intent && (
                <p className="mb-4 text-[13px] text-ink-2">
                  {data.intent.sale && data.intent.cheap
                    ? 'Showing items on sale that are also among the cheapest third of their category, lowest price first.'
                    : data.intent.cheap
                      ? 'Showing the cheapest third of each category, lowest price first.'
                      : 'Showing items on sale.'}
                </p>
              )}
              <div
                key={gridKey ?? 'all'}
                className="transition-[opacity,translate] duration-300 ease-out starting:translate-y-1.5 starting:opacity-0 motion-reduce:transition-none"
              >
                <ProductGrid products={data?.items ?? []} loading={isPending} />
              </div>
              {data && (
                <Pagination
                  page={data.page}
                  pages={data.pages}
                  onPage={(page) => update({ page: String(page) })}
                />
              )}
            </>
          )}
          {data?.related?.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-14 border-t border-seam pt-8">
              <h2 id="related-heading" className="wide mb-1 text-lg font-bold text-ink">
                Related
              </h2>
              <p className="mb-6 text-sm text-ink-3">Close to &quot;{q}&quot;, but not an exact match.</p>
              <ProductGrid products={data.related} fullRows />
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
          <Button variant="secondary" className="flex-1" onClick={clearAll} disabled={!activeFilters}>
            Clear{activeFilters ? ` ${activeFilters}` : ''}
          </Button>
          <Button className="flex-1" onClick={() => sheet.current?.close()}>
            Show {data?.total ?? ''} results
          </Button>
        </div>
      </dialog>
    </div>
  );
}

// Always in the same spot; only clickable once there's something to clear.
function ClearPill({ count, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={!count}
      aria-label={count ? `Clear ${count} filter${count === 1 ? '' : 's'}` : 'No filters to clear'}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent-ink/60 px-3 text-[12px] font-medium text-accent-ink transition-colors hover:bg-accent/10 disabled:cursor-default disabled:border-seam disabled:text-ink-3/60 disabled:hover:bg-transparent"
    >
      <X size={11} weight="bold" aria-hidden="true" />
      Clear{count ? ` ${count}` : ''}
    </button>
  );
}

function QuickToggle({ on, onChange, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-[13px] font-medium transition-colors ${
        on
          ? 'border-accent-ink/60 bg-accent/15 text-accent-ink'
          : 'border-seam bg-raised text-ink-2 hover:border-edge hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
