import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';
import { StatsView } from '../stats/StatsView.jsx';

export default function AdminDashboard() {
  useTitle('Admin');
  const query = useQuery({ queryKey: ['stats', 'admin'], queryFn: ({ signal }) => api('/admin/stats', { signal }) });

  return (
    <>
      <PanelHeader title="Platform overview" description="Sales across every shop on Loadout." />
      {query.data?.pendingSellers > 0 && (
        <Link
          to="/admin/sellers"
          className="mb-8 flex items-center justify-between gap-4 rounded-panel border border-accent/60 bg-accent/10 px-4 py-3 text-sm hover:border-accent-ink"
        >
          <span>
            {query.data.pendingSellers} seller application{query.data.pendingSellers === 1 ? '' : 's'} waiting for review
          </span>
          <span className="text-accent-ink">Review</span>
        </Link>
      )}
      <StatsView
        query={query}
        figures={(d) => [
          ['Listed products', String(d.activeProducts)],
          ['Accounts', String(d.userCount)],
        ]}
        aside={(d) => (
          <section>
            <h2 className="mb-4 font-medium">Top shops, last 30 days</h2>
            {d.topSellers.length === 0 ? (
              <p className="text-sm text-ink-3">No sales in the last 30 days.</p>
            ) : (
              <ol className="flex flex-col gap-2.5 text-sm md:max-w-md">
                {d.topSellers.map((s) => (
                  <li key={s.sellerId} className="flex items-baseline justify-between gap-4">
                    <span className="truncate text-ink-2">{s.shopName}</span>
                    <span className="font-mono text-ink tabular-nums">
                      {formatMoney(s.salesCents)}, {s.orders} orders
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      />
    </>
  );
}
