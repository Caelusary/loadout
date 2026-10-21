import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Pagination, RatingDisplay } from '../../components/ui/controls.jsx';
import { CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { ScrollRow } from '../../components/ui/ScrollRow.jsx';
import { api, sizedImageUrl } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { PhotoStrip } from '../reviews/PhotoStrip.jsx';
import { ShopReply } from '../reviews/ShopReply.jsx';

const TABS = [
  ['reply', 'Needs a reply', 'needsReply'],
  ['', 'All', 'all'],
];

// Every review on the shop's products in one place, unanswered first, so a shop doesn't have to open each
// product to find new ones. Replying works the same as on the product page.
function ProductHead({ to, children }) {
  const className = 'flex max-w-full items-center gap-3 self-start';
  return to ? (
    <Link to={to} data-cursor-skip className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export default function SellerReviews() {
  useTitle('Reviews');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [needs, setNeeds] = useState('reply');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['reviews', 'shop', needs, page],
    queryFn: ({ signal }) => api(`/seller/reviews?page=${page}${needs ? `&needs=${needs}` : ''}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviews'] });

  return (
    <>
      <PanelHeader
        title="Reviews"
        description="What buyers said about your products. You can post one public reply to each review."
      />
      <ScrollRow role="tablist" aria-label="Filter reviews" className="mb-5 flex gap-1">
        {TABS.map(([key, label, countKey]) => (
          <button
            key={key || 'all'}
            type="button"
            role="tab"
            aria-selected={needs === key}
            onClick={() => {
              setNeeds(key);
              setPage(1);
            }}
            className="h-9 shrink-0 rounded-control px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
          >
            {label}
            {data?.counts && <span className="ml-1.5 font-mono text-ink-3">{data.counts[countKey]}</span>}
          </button>
        ))}
      </ScrollRow>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <CardsSkeleton count={2} lines={2} actions={1} />
      ) : data.items.length === 0 ? (
        needs ? (
          <EmptyState title="You're all caught up">
            Every review has a reply. New ones show up here first.
          </EmptyState>
        ) : (
          <EmptyState title="No reviews yet">
            Buyers can review a product once their order is delivered.
          </EmptyState>
        )
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.items.map((r) => (
              <li key={r._id} className="flex flex-col gap-2.5 rounded-panel border border-seam p-4">
                {/* Opens the product page scrolled to this review, which glows briefly. Only as wide as the
                    product itself, and the name lights up on hover instead of the cursor's brackets. */}
                {/* A removed product has no page to open, so its name is plain text. */}
                <ProductHead to={r.product?.slug ? `/p/${r.product.slug}#review-${r._id}` : null}>
                  <span className="size-10 shrink-0 overflow-hidden rounded-control border border-seam bg-raised">
                    {r.product?.images?.[0] && (
                      <img
                        src={sizedImageUrl(r.product.images[0].url, 80)}
                        alt=""
                        className="size-full object-contain p-0.5"
                      />
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">{r.product?.name ?? 'Removed product'}</span>
                </ProductHead>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RatingDisplay value={r.rating} />
                  <h2 className="font-medium text-ink">{r.title}</h2>
                </div>
                <p className="max-w-[65ch] text-[14px] leading-relaxed text-ink-2">{r.body}</p>
                <PhotoStrip photos={r.images} owner={r.user?.name ?? 'a buyer'} />
                <p className="text-[13px] text-ink-3">
                  {r.user?.name ?? 'Deleted account'}, {formatDate(r.createdAt)}
                </p>
                <ShopReply review={r} shopName={user.sellerProfile?.shopName} isShop onChange={refresh} />
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
