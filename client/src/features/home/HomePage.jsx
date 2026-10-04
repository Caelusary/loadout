import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Container, useTitle } from '../../components/layout/Page.jsx';
import { ErrorState } from '../../components/ui/feedback.jsx';
import { api } from '../../lib/api.js';
import { ProductGrid } from '../catalog/ProductTile.jsx';
import { useFeatured, useProducts } from '../catalog/queries.js';
import { CategoryHero } from './CategoryHero.jsx';

// Products the admin features (Admin > Products). Hidden when none are featured.
function Featured() {
  const { data, isPending, isError, error, refetch } = useFeatured();
  if (!isPending && !isError && !data?.length) return null;
  return (
    <section aria-labelledby="featured-title" className="mt-10 sm:mt-16">
      <Container>
        <div className="mb-6 flex flex-col gap-1">
          <h2 id="featured-title" className="wide text-2xl font-bold">
            Featured
          </h2>
          <p className="text-sm text-ink-2">Picked by the Loadout team.</p>
        </div>
        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <ProductGrid products={data ?? []} loading={isPending} skeletonCount={4} />
        )}
      </Container>
    </section>
  );
}

function NewArrivals() {
  const { data, isPending, isError, error, refetch } = useProducts({ sort: 'newest', limit: 8 });
  return (
    <section aria-labelledby="new-title" className="mt-16">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="new-title" className="wide text-2xl font-bold">
            New in
          </h2>
          <Link to="/shop" className="text-sm text-ink-2 hover:text-accent-ink">
            See all products
          </Link>
        </div>
        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <ProductGrid products={data?.items ?? []} loading={isPending} />
        )}
      </Container>
    </section>
  );
}

function Shops() {
  const { data } = useQuery({
    queryKey: ['shops', 'featured'],
    queryFn: async () => {
      const slugs = ['northpaw-keys', 'glide-lab', 'hush-audio'];
      const results = await Promise.allSettled(slugs.map((s) => api(`/shops/${s}`)));
      return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    },
    staleTime: 5 * 60_000,
  });
  if (!data?.length) return null;
  return (
    <section aria-labelledby="shops-title" className="mt-24">
      <Container>
        <h2 id="shops-title" className="wide mb-2 text-2xl font-bold">
          The shops
        </h2>
        <p className="mb-8 max-w-xl text-sm text-ink-2">
          Every product comes from an independent seller who ships it themselves.
        </p>
        <ul className="divide-y divide-seam border-y border-seam">
          {data.map(({ shop, products }) => (
            <li key={shop.slug}>
              <Link
                to={`/s/${shop.slug}`}
                className="group grid gap-2 py-6 sm:grid-cols-[240px_minmax(0,1fr)_auto] sm:items-center sm:gap-8"
              >
                <span className="wide text-lg font-bold group-hover:text-accent-ink">{shop.shopName}</span>
                <span className="text-sm text-ink-2">{shop.bio}</span>
                <span className="font-mono text-[13px] text-ink-3 tabular-nums">
                  {products.length} products
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export default function HomePage() {
  useTitle();
  return (
    <>
      <CategoryHero />
      <Featured />
      <NewArrivals />
      <Shops />
    </>
  );
}
