import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDate, formatMoney, orderNumber } from '../../lib/format.js';

const LABELS = {
  stuck: 'Stuck with the shop',
  requested: 'New',
  approved: 'Approved',
  declined: 'Declined',
  escalated: 'With an admin',
  refunded: 'Refunded',
  closed: 'Closed',
};

// A list of returns for the Seller Center or the admin panel. Each one opens on its order, where the
// history and the approve / decline / received actions are.
export function ReturnsList({ title, description, endpoint, statuses, showShop }) {
  useTitle(title);
  const [status, setStatus] = useState(statuses[0]);
  const [page, setPage] = useState(1);
  const params = { status, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['returns', endpoint, params],
    queryFn: ({ signal }) => api(`${endpoint}${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PanelHeader title={title} description={description} />
      <div role="tablist" aria-label="Filter by status" className="mb-5 flex flex-wrap gap-1">
        {statuses.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`h-9 rounded-control px-3 text-sm transition-colors ${status === s ? 'bg-raised text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : (
        <>
          <Table
            columns={[
              { label: 'Order' },
              { label: 'Customer' },
              ...(showShop ? [{ label: 'Shop' }] : []),
              { label: 'Asked' },
              { label: 'Refund', align: 'right' },
              { label: '', align: 'right' },
            ]}
            empty={data.items.length === 0 && <EmptyState title="Nothing here">Returns with this status show up here.</EmptyState>}
          >
            {data.items.map((r) => (
              <tr key={r._id}>
                <Cell className="font-mono">{orderNumber(r.order)}</Cell>
                <Cell>{r.user?.name ?? 'Deleted account'}</Cell>
                {showShop && <Cell className="text-ink-2">{r.seller?.sellerProfile?.shopName ?? 'Deleted shop'}</Cell>}
                <Cell className="text-ink-2">{formatDate(r.createdAt)}</Cell>
                <Cell align="right" className="font-mono tabular-nums">
                  {formatMoney(r.refundCents)}
                </Cell>
                <Cell align="right">
                  <ButtonLink to={`/orders/${r.order}`} variant="ghost" size="sm">
                    Review
                  </ButtonLink>
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
