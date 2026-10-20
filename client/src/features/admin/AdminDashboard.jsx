import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { api } from '../../lib/api.js';
import { formatMoney, plural } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { StatsView } from '../stats/StatsView.jsx';

// Everything waiting on an admin, in the menu's order. Only the areas this admin manages come back in the counts.
const WAITING = [
  ['sellers', '/admin/approvals?tab=shops', (n) => `${plural(n, 'shop application')}`],
  ['returns', '/admin/returns', (n) => `${plural(n, 'return')} needing an admin`],
  ['riders', '/admin/approvals?tab=vehicles', (n) => `${plural(n, 'vehicle change')} to approve`],
  ['complaints', '/admin/complaints', (n) => `${plural(n, 'complaint')} from buyers`],
];

export default function AdminDashboard() {
  useTitle('Admin');
  // Order lists are for admins who manage orders; for the others the figures are just figures, not dead links.
  const { can } = useAuth();
  const orders = can('orders');
  const query = useQuery({
    queryKey: ['stats', 'admin'],
    queryFn: ({ signal }) => api('/admin/stats', { signal }),
  });
  // The same counts the menu badges poll, so the two never disagree.
  const { data: waiting } = useQuery({
    queryKey: ['admin', 'counts'],
    queryFn: ({ signal }) => api('/admin/counts', { signal }),
    refetchInterval: 60_000,
  });
  const piles = WAITING.filter(([key]) => waiting?.counts?.[key] > 0);

  return (
    <>
      <PanelHeader title="Platform overview" description="Sales across every shop on Loadout." />
      {piles.length > 0 && (
        <section
          aria-labelledby="waiting-heading"
          className="mb-8 rounded-panel border border-accent/60 bg-accent/10 px-4 py-3"
        >
          <h2 id="waiting-heading" className="mb-1 text-[13px] font-medium text-accent-ink">
            Waiting for you
          </h2>
          <ul className="flex flex-col">
            {piles.map(([key, to, text]) => (
              <li key={key}>
                <Link
                  to={to}
                  className="-mx-2 flex items-center justify-between gap-4 rounded-control px-2 py-1.5 text-sm hover:bg-accent/10"
                >
                  <span>{text(waiting.counts[key])}</span>
                  <span className="text-accent-ink">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <StatsView
        query={query}
        statusLink={orders ? (st) => `/admin/orders?status=${st}` : undefined}
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
              // Same rows and columns as Top products above: name, count, then money, numbers right-aligned.
              <ol className="flex flex-col text-sm md:max-w-md">
                {d.topSellers.map((s) => (
                  <li
                    key={s.sellerId}
                    className="grid h-10 grid-cols-[minmax(0,1fr)_4.5rem_6rem] items-center gap-4"
                  >
                    {orders ? (
                      <Link
                        to={`/admin/orders?seller=${s.sellerId}`}
                        data-cursor-skip
                        className="truncate text-ink-2"
                      >
                        {s.shopName}
                      </Link>
                    ) : (
                      <span className="truncate text-ink-2">{s.shopName}</span>
                    )}
                    <span className="text-right font-mono text-ink-2 tabular-nums">
                      {s.orders} {s.orders === 1 ? 'order' : 'orders'}
                    </span>
                    <span className="text-right font-mono text-ink tabular-nums">
                      {formatMoney(s.salesCents)}
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
