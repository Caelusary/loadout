import { CheckCircle } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Price, StatusPill } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api } from '../../lib/api.js';
import { orderNumber, formatMoney } from '../../lib/format.js';

export default function OrderConfirmedPage() {
  useTitle('Order placed');
  const { checkoutId } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['orders', 'mine', checkoutId],
    queryFn: ({ signal }) => api(`/orders/mine?checkoutId=${encodeURIComponent(checkoutId)}`, { signal }).then((r) => r.items),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-14 sm:px-6">
      <CheckCircle size={40} weight="fill" className="mb-4 text-ok" />
      <h1 className="wide text-[30px] leading-tight font-bold">Your order is placed</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {data?.length > 1
          ? `Your cart became ${data.length} orders, one per shop. Each shop ships its own items.`
          : 'The shop will start processing it soon. You can cancel until then.'}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isPending ? (
          <Skeleton className="h-20" />
        ) : (
          data.map((order) => (
            <Link
              key={order._id}
              to={`/orders/${order._id}`}
              className="flex items-center justify-between gap-4 rounded-panel border border-seam p-4 transition-colors hover:border-edge"
            >
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{order.seller?.sellerProfile?.shopName ?? 'Shop'}</p>
                <p className="font-mono text-[13px] text-ink-3">
                  {orderNumber(order._id)}, {order.items.reduce((n, i) => n + i.qty, 0)} item(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={order.status} />
                <Price cents={order.totalCents} className="font-medium" />
              </div>
            </Link>
          ))
        )}
      </div>
      {data?.some((o) => o.discountCents > 0) && (
        <p className="mt-4 text-sm text-ok">
          {data[0].couponCode} saved you {formatMoney(data.reduce((sum, o) => sum + (o.discountCents ?? 0), 0))}.
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/account/orders" variant="secondary">
          View all orders
        </ButtonLink>
        <ButtonLink to="/shop" variant="ghost">
          Keep shopping
        </ButtonLink>
      </div>
    </div>
  );
}
