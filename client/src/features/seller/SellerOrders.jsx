import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import {
  ORDER_STATUSES,
  SHOP_NEXT as NEXT,
  SHOP_NEXT_LABEL as NEXT_LABEL,
  STATUS_LABELS,
} from '../../lib/constants.js';
import { orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { OrdersTable, StatusTabs } from '../orders/OrdersTable.jsx';


export default function SellerOrders() {
  useTitle('Shop orders');
  const toast = useToast();
  const queryClient = useQueryClient();
  // The tab and page live in the address (the dashboard links here with ?status=), so opening an order and coming
  // Back lands on the same list. No status opens on Placed, the orders waiting on the shop; ?status=all is All.
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get('status');
  const status = linked === 'all' ? '' : ORDER_STATUSES.includes(linked) ? linked : 'placed';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const show = (nextStatus, nextPage) =>
    setSearchParams(
      { status: nextStatus || 'all', ...(nextPage > 1 ? { page: String(nextPage) } : {}) },
      { replace: true },
    );
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
      <PanelHeader
        title="Orders"
        description="Prepare each order, then mark it ready for pickup. The rider collects it and marks it delivered."
      />
      <StatusTabs
        counts={data?.counts}
        value={status}
        onChange={(s) => {
          show(s, 1);
        }}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <OrdersTable orders={[]} action={() => null} loading />
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
          <Pagination page={data.page} pages={data.pages} onPage={(n) => show(status, n)} />
        </>
      )}
    </>
  );
}
