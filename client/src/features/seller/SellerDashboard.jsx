import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { StatsView } from '../stats/StatsView.jsx';

export default function SellerDashboard() {
  useTitle('Seller Center');
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['stats', 'seller'],
    queryFn: ({ signal }) => api('/seller/stats', { signal }),
  });

  return (
    <>
      <PanelHeader
        title={user.sellerProfile.shopName}
        description="Sales and orders for your shop."
        action={
          <ButtonLink to="/seller/products/new" size="sm">
            Add product
          </ButtonLink>
        }
      />
      <StatsView
        query={query}
        // Held and released are simulated, like Shopee's Guarantee: buyers' money waits until they confirm delivery.
        statusLink={(s) => `/seller/orders?status=${s}`}
        productLink={(p) => `/seller/products/${p.productId}/edit`}
        figures={(d) => [
          ['Waiting to process', String(d.ordersByStatus.placed), '/seller/orders?status=placed'],
          ['Low on stock', String(d.lowStock.length)],
          ['Held until buyers confirm', formatMoney(d.payouts.heldCents)],
          ['Released, last 30 days', formatMoney(d.payouts.releasedCents30d)],
        ]}
        aside={(d) =>
          d.lowStock.length > 0 && (
            <section>
              <h2 className="mb-4 font-medium">Low on stock</h2>
              <ul className="flex flex-col gap-2.5 text-sm">
                {d.lowStock.map((p) => (
                  <li key={p._id} className="flex items-baseline justify-between gap-4">
                    <Link
                      to={`/seller/products/${p._id}/edit`}
                      className="truncate text-ink-2 hover:text-accent-ink"
                    >
                      {p.name}
                    </Link>
                    <span className={`font-mono tabular-nums ${p.stock === 0 ? 'text-bad' : 'text-warn'}`}>
                      {p.stock === 0 ? 'Sold out' : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        }
      />
    </>
  );
}
