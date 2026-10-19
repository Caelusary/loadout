import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ScrollRow } from '../../components/ui/ScrollRow.jsx';
import { api } from '../../lib/api.js';
import { OrderRow } from '../orders/OrderRow.jsx';

// The shop's steps grouped the way a buyer thinks of them (the server groups them the same way).
const TABS = [
  ['', 'All', 'all'],
  ['to-ship', 'To ship'],
  ['on-the-way', 'On the way'],
  ['delivered', 'Delivered'],
  ['refunded', 'Refunded'],
  ['cancelled', 'Cancelled'],
];
const EMPTY = {
  'to-ship': 'Nothing waiting on a shop right now.',
  'on-the-way': 'Nothing is out for delivery right now.',
  delivered: 'No delivered orders yet.',
  refunded: 'No fully refunded orders.',
  cancelled: 'No cancelled orders.',
};

export default function MyOrdersPage() {
  useTitle('My orders');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['orders', 'mine', group, page],
    queryFn: ({ signal }) =>
      api(`/orders/mine?page=${page}&limit=20${group ? `&group=${group}` : ''}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const counts = data?.counts;

  return (
    <>
      <PanelHeader
        title="My orders"
        description="You can cancel an order until the shop starts processing it."
      />
      {counts?.all > 0 && (
        <ScrollRow role="tablist" aria-label="Filter by status" className="mb-5 flex gap-1">
          {TABS.map(([key, label, countKey = key]) => (
            <button
              key={key || 'all'}
              type="button"
              role="tab"
              aria-selected={group === key}
              onClick={() => {
                setGroup(key);
                setPage(1);
              }}
              className="h-9 shrink-0 rounded-control px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
            >
              {label}
              <span className="ml-1.5 font-mono text-ink-3">{counts[countKey] ?? 0}</span>
            </button>
          ))}
        </ScrollRow>
      )}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-panel" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        group ? (
          <EmptyState title={EMPTY[group]}>
            Orders move between these tabs as the shop and rider update them.
          </EmptyState>
        ) : (
          <EmptyState title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>}>
            Orders you place show up here with their shipping status.
          </EmptyState>
        )
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {data.items.map((order) => (
              <OrderRow key={order._id} order={order} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
