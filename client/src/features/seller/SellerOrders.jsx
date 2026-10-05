import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import { STATUS_LABELS } from '../../lib/constants.js';
import { orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { OrdersTable, StatusTabs } from '../orders/OrdersTable.jsx';

const NEXT = { placed: 'processing', processing: 'shipped', shipped: 'delivered' };
const NEXT_LABEL = { processing: 'Start processing', shipped: 'Mark shipped', delivered: 'Mark delivered' };

export default function SellerOrders() {
  useTitle('Shop orders');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('placed');
  const [page, setPage] = useState(1);
  const params = { status, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['orders', 'sold', params],
    queryFn: ({ signal }) => api(`/orders/sold${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const advance = useMutation({
    mutationFn: ({ id, next }) => api(`/orders/${id}/status`, { method: 'PATCH', body: { status: next } }),
    onSuccess: (res) => {
      toast.show(`${orderNumber(res.order._id)} is now ${STATUS_LABELS[res.order.status].toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PanelHeader title="Orders" description="Move each order forward as you pack and ship it." />
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
          <OrdersTable
            orders={data.items}
            action={(o) =>
              NEXT[o.status] && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={advance.isPending && advance.variables?.id === o._id}
                  onClick={() => advance.mutate({ id: o._id, next: NEXT[o.status] })}
                >
                  {NEXT_LABEL[NEXT[o.status]]}
                </Button>
              )
            }
          />
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
