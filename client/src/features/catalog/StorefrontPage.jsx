import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { NotFound } from '../../components/layout/NotFound.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, assetUrl } from '../../lib/api.js';
import { formatDate, initials } from '../../lib/format.js';
import { ProductGrid } from './ProductTile.jsx';

export default function StorefrontPage() {
  const { slug } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['shop', slug],
    queryFn: ({ signal }) => api(`/shops/${slug}`, { signal }),
  });
  useTitle(data?.shop.shopName ?? 'Shop');

  if (isError) return error.status === 404 ? <NotFound /> : <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-10 sm:px-6">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        {isPending ? (
          <Skeleton className="size-20 rounded-panel" />
        ) : data.shop.logoUrl ? (
          <img src={assetUrl(data.shop.logoUrl)} alt="" className="size-20 rounded-panel object-cover" />
        ) : (
          <span className="widest grid size-20 place-items-center rounded-panel bg-raised text-2xl font-extrabold text-accent-ink">
            {initials(data.shop.shopName)}
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          {isPending ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <>
              <h1 className="wide text-[32px] leading-tight font-bold">{data.shop.shopName}</h1>
              {data.shop.bio && <p className="max-w-[60ch] text-[15px] text-ink-2">{data.shop.bio}</p>}
              <p className="font-mono text-[13px] text-ink-3 tabular-nums">
                {data.products.length} product{data.products.length === 1 ? '' : 's'}, selling since {formatDate(data.shop.since)}
              </p>
            </>
          )}
        </div>
      </header>
      {!isPending && data.products.length === 0 ? (
        <EmptyState title="No products listed yet">This shop hasn&apos;t listed anything. Check back soon.</EmptyState>
      ) : (
        <ProductGrid products={data?.products ?? []} loading={isPending} />
      )}
    </div>
  );
}
