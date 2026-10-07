import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Phone } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OrderStatus } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import { STATUS_LABELS } from '../../lib/constants.js';
import { formatMoney, orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const NEXT = { shipped: 'out-for-delivery', 'out-for-delivery': 'delivered' };
const NEXT_LABEL = { 'out-for-delivery': 'Out for delivery', delivered: 'Mark delivered' };
const VIEWS = [
  ['active', 'To deliver'],
  ['done', 'Done'],
];

// A rider's run sheet: who to bring each parcel to, and one tap per step. Laid out for a phone.
export default function DeliveriesPage() {
  useTitle('Deliveries');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState('active');
  const [page, setPage] = useState(1);
  const params = { view, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['deliveries', params],
    queryFn: ({ signal }) => api(`/deliveries${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const advance = useMutation({
    mutationFn: ({ id, next }) => api(`/deliveries/${id}`, { method: 'PATCH', body: { status: next } }),
    onSuccess: (res) => {
      toast.show(`${orderNumber(res.order._id)} is ${STATUS_LABELS[res.order.status].toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['order', res.order._id] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
      <h1 className="wide text-[28px] font-bold">Deliveries</h1>
      <p className="mt-1 text-sm text-ink-2">Shops hand orders to you when they mark them shipped. Oldest first.</p>

      <div role="tablist" aria-label="Deliveries" className="mt-6 mb-5 flex gap-1">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => {
              setView(value);
              setPage(1);
            }}
            className="h-9 rounded-control px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-48 rounded-panel" />
      ) : data.items.length === 0 ? (
        <EmptyState title={view === 'active' ? 'Nothing to deliver' : 'No deliveries yet'}>
          {view === 'active' ? 'New deliveries show up here when a shop ships an order to you.' : 'Orders you deliver show up here.'}
        </EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {data.items.map((o) => {
              const next = NEXT[o.status];
              const to = o.shippingAddress;
              return (
                <li key={o._id} className="flex flex-col gap-3 rounded-panel border border-seam bg-plate p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/orders/${o._id}`} className="font-mono text-[15px] font-medium hover:text-accent-ink">
                      {orderNumber(o._id)}
                    </Link>
                    <OrderStatus order={o} />
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">{to.fullName}</span>
                    <span className="flex items-start gap-2 text-ink-2">
                      <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {to.line1}, {to.city}, {to.province} {to.postalCode}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-ink-2">
                      <Phone size={16} className="shrink-0" aria-hidden="true" />
                      {to.phone}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-3">
                    From {o.seller?.sellerProfile?.shopName ?? 'a shop'} · {o.items.reduce((n, i) => n + i.qty, 0)} item(s) ·{' '}
                    {o.paymentMethod === 'cod' ? `Collect ${formatMoney(o.totalCents)} cash` : 'Paid online'}
                  </p>
                  {next && (
                    <Button
                      className="self-start max-sm:w-full"
                      variant={next === 'delivered' ? 'primary' : 'secondary'}
                      loading={advance.isPending && advance.variables?.id === o._id}
                      onClick={() => advance.mutate({ id: o._id, next })}
                    >
                      {NEXT_LABEL[next]}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
