import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { NotFound } from '../../components/layout/NotFound.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { OrderStatus, Price } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api } from '../../lib/api.js';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { PAYMENT_LABELS, STATUS_LABELS } from '../../lib/constants.js';
import { formatDateTime, formatMoney, orderNumber } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { ReturnsPanel } from './ReturnsPanel.jsx';

const STEPS = ['placed', 'processing', 'shipped', 'out-for-delivery', 'delivered'];
// The shop prepares and hands over; the rider takes it from there.
const NEXT = { placed: 'processing', processing: 'shipped' };
const NEXT_LABEL = { processing: 'Start processing', shipped: 'Hand to rider' };
const RIDER_NEXT = { shipped: 'out-for-delivery', 'out-for-delivery': 'delivered' };
const RIDER_LABEL = { 'out-for-delivery': 'Out for delivery', delivered: 'Mark delivered' };

// A step tracker built from the order's status history. Each reached step shows when it happened;
// a cancelled order shows the steps it got through and where it stopped.
function Timeline({ order }) {
  const history = order.statusHistory?.length ? order.statusHistory : [{ status: 'placed', at: order.createdAt }];
  // 'placed' always comes from createdAt: orders saved before status history existed get a schema default
  // stamped with the time they were loaded, which would be wrong.
  const when = { ...Object.fromEntries(history.map((e) => [e.status, e.at])), placed: order.createdAt };
  const cancelled = order.status === 'cancelled';
  const reached = STEPS.filter((s) => when[s]);
  const steps = cancelled ? [...reached, 'cancelled'] : STEPS;
  const current = cancelled ? steps.length - 1 : STEPS.indexOf(order.status);

  return (
    <ol className="grid gap-y-4 sm:grid-flow-col sm:auto-cols-fr" aria-label="Order timeline">
      {steps.map((step, i) => {
        const done = i <= current;
        const stop = step === 'cancelled';
        return (
          <li key={step} className="relative flex gap-3 sm:flex-col sm:gap-2" aria-current={i === current ? 'step' : undefined}>
            <div className="flex flex-col items-center sm:flex-row">
              <span
                className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                  stop ? 'border-bad bg-bad' : done ? 'border-accent bg-accent' : 'border-seam bg-bg'
                }`}
              >
                {done && <span className={`size-2 rounded-full ${stop ? 'bg-bg' : 'bg-on-accent'}`} />}
              </span>
              {i < steps.length - 1 && (
                <span className={`h-full min-h-6 w-0.5 sm:h-0.5 sm:min-h-0 sm:w-full ${i < current ? 'bg-accent' : 'bg-seam'}`} aria-hidden="true" />
              )}
            </div>
            <div className="flex flex-col pb-1">
              <span className={`text-[14px] font-medium ${stop ? 'text-bad' : done ? 'text-ink' : 'text-ink-3'}`}>{STATUS_LABELS[step]}</span>
              {/* Orders from before riders went straight from shipped to delivered. */}
              <span className="font-mono text-[12px] text-ink-3 tabular-nums">{when[step] ? formatDateTime(when[step]) : done ? '—' : 'Not yet'}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { data: order, isPending, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => api(`/orders/${id}`, { signal }).then((r) => r.order),
  });
  useTitle(order ? `Order ${orderNumber(order._id)}` : 'Order');

  const onDone = (message) => (res) => {
    // Status changes come back without the customer and shop filled in; keep the ones already loaded.
    queryClient.setQueryData(['order', id], (old) => ({ ...res.order, user: old?.user, seller: old?.seller }));
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    toast.show(message);
  };
  const cancel = useMutation({
    mutationFn: () => api(`/orders/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: (res) => {
      setConfirmCancel(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onDone('Order cancelled')(res);
    },
    onError: (err) => toast.error(err.message),
  });
  const deliver = useMutation({
    mutationFn: (status) => api(`/deliveries/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      onDone(`Order marked as ${STATUS_LABELS[res.order.status].toLowerCase()}`)(res);
    },
    onError: (err) => toast.error(err.message),
  });
  const advance = useMutation({
    mutationFn: (status) => api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: (res) => onDone(`Order marked as ${STATUS_LABELS[res.order.status].toLowerCase()}`)(res),
    onError: (err) => toast.error(err.message),
  });

  if (isError) return error.status === 404 ? <NotFound /> : <ErrorState error={error} onRetry={refetch} />;
  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pt-10 sm:px-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const isCustomer = order.user?._id === user._id;
  const isSellerOfOrder = order.seller?._id === user._id;
  const isRiderOfOrder = order.rider?._id === user._id;
  const riderNext = isRiderOfOrder ? RIDER_NEXT[order.status] : undefined;
  const next = NEXT[order.status];
  const isOrdersAdmin = can('orders');
  const canCancel = (isCustomer && order.status === 'placed') || (isOrdersAdmin && !['delivered', 'cancelled'].includes(order.status));
  const backTo = isOrdersAdmin ? '/admin/orders' : isSellerOfOrder ? '/seller/orders' : isRiderOfOrder ? '/deliveries' : '/account/orders';
  const cancelledBy = { customer: 'the customer', seller: 'the shop', admin: 'the store admin' }[order.cancelledBy] ?? 'the customer';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6">
      <Link to={backTo} className="text-[13px] text-ink-3 hover:text-ink">
        Back to orders
      </Link>
      <div className="mt-3 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="wide font-mono text-[28px] font-bold">{orderNumber(order._id)}</h1>
            <OrderStatus order={order} />
          </div>
          <p className="text-sm text-ink-2">
            Placed {formatDateTime(order.createdAt)}
            {isCustomer ? ` with ${order.seller?.sellerProfile?.shopName ?? 'a shop'}` : ` by ${order.user?.name ?? 'a deleted account'}`}
          </p>
          {order.status === 'cancelled' && (
            <p className="text-sm text-bad">
              Cancelled by {cancelledBy}.{order.cancelReason && ` ${order.cancelReason}`} Any stock went back to the shop.
            </p>
          )}
          {order.status === 'delivered' && order.deliveredBy === 'auto' && (
            <p className="text-sm text-ink-3">Marked delivered automatically 7 days after it shipped.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isSellerOfOrder && next && (
            <Button onClick={() => advance.mutate(next)} loading={advance.isPending}>
              {NEXT_LABEL[next]}
            </Button>
          )}
          {riderNext && (
            <Button onClick={() => deliver.mutate(riderNext)} loading={deliver.isPending}>
              {RIDER_LABEL[riderNext]}
            </Button>
          )}
          {canCancel && (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          )}
        </div>
      </div>

      <Timeline order={order} />

      <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Items">
          <ul className="divide-y divide-seam border-y border-seam">
            {order.items.map((item) => (
              <li key={item.product} className="flex items-center gap-4 py-4">
                <ProductImage src={item.image} className="size-16 shrink-0 rounded-control" size={160} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="font-mono text-[13px] text-ink-3 tabular-nums">
                    {item.qty} × {formatMoney(item.priceCents)}
                  </p>
                </div>
                <Price cents={item.priceCents * item.qty} className="font-medium" />
              </li>
            ))}
          </ul>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Shipping</dt>
              <dd className="font-mono tabular-nums">{order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents)}</dd>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-ok">
                <dt>Discount ({order.couponCode})</dt>
                <dd className="font-mono tabular-nums">−{formatMoney(order.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-medium">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{formatMoney(order.totalCents)}</dd>
            </div>
            {order.refundedCents > 0 && (
              <div className="flex justify-between text-ok">
                <dt>Refunded for returns</dt>
                <dd className="font-mono tabular-nums">−{formatMoney(order.refundedCents)}</dd>
              </div>
            )}
          </dl>
        </section>
        <aside className="flex flex-col gap-6 text-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-medium text-ink-3">Ship to</h2>
            <p>{order.shippingAddress.fullName}</p>
            <p className="text-ink-2">{order.shippingAddress.line1}</p>
            <p className="text-ink-2">
              {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}
            </p>
            <p className="font-mono text-ink-2">{order.shippingAddress.phone}</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-medium text-ink-3">Payment</h2>
            <p>{PAYMENT_LABELS[order.paymentMethod]}</p>
          </div>
          {order.rider && (
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] font-medium text-ink-3">Rider</h2>
              <p>{isRiderOfOrder ? 'You' : order.rider.name}</p>
              {order.deliveredBy === 'rider' && <p className="text-ink-2">Delivered by the rider</p>}
            </div>
          )}
          {!isCustomer && order.user && (
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] font-medium text-ink-3">Customer</h2>
              <p>{order.user.name}</p>
              <p className="text-ink-2">{order.user.email}</p>
            </div>
          )}
        </aside>
      </div>

      {!isRiderOfOrder && <ReturnsPanel order={order} isCustomer={isCustomer} isSellerOfOrder={isSellerOfOrder} />}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      >
        The items go back into stock. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}
