import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { NotFound } from '../../components/layout/NotFound.jsx';
import { SwitchChip } from '../../components/ui/chips.jsx';
import { RatingDisplay } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { recordRecent, readRecent } from '../../lib/recentlyViewed.js';
import { CATEGORY_LABELS, SPEC_FIELDS } from '../../lib/constants.js';
import { formatSpec, SPEC_NAMES } from '../../lib/format.js';
import { ProductGrid } from './ProductTile.jsx';
import { useProduct, useProducts } from './queries.js';
import { BuyBox } from './BuyBox.jsx';
import { Gallery } from './ProductGallery.jsx';

const ReviewSection = lazy(() =>
  import('../reviews/ReviewSection.jsx').then((m) => ({ default: m.ReviewSection })),
);

function SpecList({ product }) {
  const keys = (SPEC_FIELDS[product.category] ?? []).filter((k) => product.specs?.[k] !== undefined);
  if (keys.length === 0) return null;
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-8 gap-y-2.5 text-sm">
      {keys.map((key) => (
        <div key={key} className="contents">
          <dt className="text-ink-3">{SPEC_NAMES[key]}</dt>
          <dd className="font-mono text-ink tabular-nums">
            {key === 'switchType' ? (
              <SwitchChip type={product.specs[key]} />
            ) : (
              formatSpec(key, product.specs[key])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SimilarProducts({ product }) {
  const { data } = useProducts({ category: product.category, limit: 5 });
  const items = (data?.items ?? []).filter((p) => p._id !== product._id).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="mt-20" aria-labelledby="similar-title">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="similar-title" className="wide text-2xl font-bold">
          More {CATEGORY_LABELS[product.category].toLowerCase()}
        </h2>
        <Link to={`/shop?category=${product.category}`} className="text-sm text-ink-2 hover:text-accent-ink">
          See all
        </Link>
      </div>
      <ProductGrid products={items} />
    </section>
  );
}

// Remembers this product and lists the ones viewed before it (fresh prices via ?ids=).
function RecentlyViewed({ product }) {
  const [ids] = useState(() =>
    readRecent()
      .filter((id) => id !== product._id)
      .slice(0, 4),
  );
  useEffect(() => {
    recordRecent(product._id);
  }, [product._id]);
  const { data } = useProducts({ ids: ids.join(',') }, { enabled: ids.length > 0 });
  const items = (data?.items ?? []).filter((p) => p.isActive);
  if (items.length === 0) return null;
  return (
    <section className="mt-20" aria-labelledby="recent-title">
      <h2 id="recent-title" className="wide mb-6 text-2xl font-bold">
        Recently viewed
      </h2>
      <ProductGrid products={items} />
    </section>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, isPending, isError, error, refetch } = useProduct(slug);
  useTitle(product?.name ?? 'Product');

  if (isError) return error.status === 404 ? <NotFound /> : <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 flex gap-2 text-[13px] text-ink-3">
        <Link to="/shop" className="hover:text-ink">
          Shop
        </Link>
        {product && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/shop?category=${product.category}`} className="hover:text-ink">
              {CATEGORY_LABELS[product.category]}
            </Link>
          </>
        )}
      </nav>

      {isPending ? (
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <Skeleton className="aspect-square rounded-panel" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <Gallery product={product} />
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                {product.seller?.sellerProfile && (
                  <Link
                    to={`/s/${product.seller.sellerProfile.slug}`}
                    className="w-fit text-sm text-ink-2 hover:text-accent-ink"
                  >
                    {product.seller.sellerProfile.shopName}
                  </Link>
                )}
                <h1 className="wide text-[30px] leading-[1.1] font-bold sm:text-[36px]">{product.name}</h1>
                {product.ratingCount > 0 && (
                  <a href="#reviews" className="w-fit">
                    <RatingDisplay value={product.ratingAvg} count={product.ratingCount} />
                  </a>
                )}
              </div>
              <BuyBox product={product} />
              <SpecList product={product} />
              {product.description && (
                <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{product.description}</p>
              )}
            </div>
          </div>
          <Suspense fallback={<Skeleton className="h-40" />}>
            <ReviewSection product={product} />
          </Suspense>
          <SimilarProducts product={product} />
          <RecentlyViewed key={product._id} product={product} />
        </>
      )}
    </div>
  );
}
