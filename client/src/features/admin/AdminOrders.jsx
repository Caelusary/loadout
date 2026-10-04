import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import { OrdersTable, StatusTabs } from '../orders/OrdersTable.jsx';

export default function AdminOrders() {
  useTitle('All orders');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = { status, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: ({ signal }) => api(`/admin/orders${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PanelHeader title="Orders" description="Every order on the platform. Open one to cancel it before delivery." />
      <StatusTabs
        value={status}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : (
        <>
          <OrdersTable orders={data.items} showShop />
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
