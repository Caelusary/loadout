import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api } from '../../lib/api.js';
import { OrderRow } from '../orders/OrderRow.jsx';

export default function MyOrdersPage() {
  useTitle('My orders');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['orders', 'mine', page],
    queryFn: ({ signal }) => api(`/orders/mine?page=${page}&limit=20`, { signal }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PanelHeader title="My orders" description="You can cancel an order until the shop starts processing it." />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-panel" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>}>
          Orders you place show up here with their shipping status.
        </EmptyState>
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
