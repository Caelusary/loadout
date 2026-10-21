import { MapPin, Phone } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { NotFound } from '../../components/layout/NotFound.jsx';
import { OrderStatus } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { PAYMENT_LABELS } from '../../lib/constants.js';
import { formatDateTime, orderNumber } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { DeliveryCheck } from './DeliveryCheck.jsx';
import { MissedAttempts } from './MissedAttempts.jsx';
import { OrderActions } from './OrderActions.jsx';
import { OrderItems } from './OrderItems.jsx';
import { orderQuery } from './queries.js';
import { OrderTimeline } from './OrderTimeline.jsx';
import { RiderCard } from './RiderCard.jsx';
import { DeliveryProof, PaymentNote } from './OrderExtras.jsx';
import { ReturnsPanel } from './ReturnsPanel.jsx';
import { mapsLink } from '../rider/delivery.js';

// One order, seen by its customer, its shop, its rider or an admin. Each section decides what its viewer may see;
// the sections live in their own files next to this one.
export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const { data: order, isPending, isError, error, refetch } = useQuery(orderQuery(id));
  useTitle(order ? `Order ${orderNumber(order._id)}` : 'Order');
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
  const isOrdersAdmin = can('orders');
  const canManageRiders = can('users');
  const canCancel =
    (isCustomer && order.status === 'placed') ||
    (isOrdersAdmin && !['delivered', 'cancelled'].includes(order.status));
  const cancelledBy =
    { customer: 'the customer', seller: 'the shop', admin: 'the store admin' }[order.cancelledBy] ??
    'the customer';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="wide font-mono text-[28px] font-bold">{orderNumber(order._id)}</h1>
            <OrderStatus order={order} />
          </div>
          <p className="text-sm text-ink-2">
            Placed {formatDateTime(order.createdAt)}
            {isCustomer ? (
              <>
                {' with '}
                {order.seller?.sellerProfile?.slug ? (
                  <Link to={`/s/${order.seller.sellerProfile.slug}`} data-cursor-skip className="text-ink">
                    {order.seller.sellerProfile.shopName}
                  </Link>
                ) : (
                  (order.seller?.sellerProfile?.shopName ?? 'a shop')
                )}
              </>
            ) : (
              <>
                {` by ${order.user?.name ?? 'a deleted account'}`}
                {/* Admins also need which shop it's from; the name opens that shop's orders. */}
                {isOrdersAdmin && !isSellerOfOrder && order.seller?.sellerProfile?.shopName && (
                  <>
                    {' from '}
                    <Link
                      to={`/admin/orders?seller=${order.seller._id}`}
                      data-cursor-skip
                      className="text-ink"
                    >
                      {order.seller.sellerProfile.shopName}
                    </Link>
                  </>
                )}
              </>
            )}
          </p>
          {order.status === 'cancelled' && (
            <p className="text-sm text-bad">
              {order.cancelledBy === 'delivery' ? 'Cancelled.' : `Cancelled by ${cancelledBy}.`}
              {order.cancelReason && ` ${order.cancelReason}`} Any stock went back to the shop.
            </p>
          )}
          {order.status === 'delivered' && order.deliveredBy === 'auto' && (
            <p className="text-sm text-ink-3">
              Marked delivered automatically 7 days after it was ready for pickup.
            </p>
          )}
        </div>
        <OrderActions
          order={order}
          isSellerOfOrder={isSellerOfOrder}
          isRiderOfOrder={isRiderOfOrder}
          canCancel={canCancel}
        />
      </div>

      <DeliveryCheck
        order={order}
        isCustomer={isCustomer}
        isRider={isRiderOfOrder}
        canSettle={isOrdersAdmin}
      />
      <MissedAttempts order={order} isCustomer={isCustomer} />

      <OrderTimeline order={order} />

      <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_280px]">
        <OrderItems order={order} isCustomer={isCustomer} />
        <aside className="flex flex-col gap-6 text-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-medium text-ink-3">Ship to</h2>
            {order.shippingAddress.fullName && <p>{order.shippingAddress.fullName}</p>}
            {/* The rider gets the run sheet's maps and call links here too; everyone else reads plain text. */}
            {isRiderOfOrder && order.shippingAddress.line1 ? (
              <a
                href={mapsLink(order.shippingAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-ink-2 underline-offset-2 hover:text-accent-ink hover:underline"
              >
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {order.shippingAddress.line1}, {order.shippingAddress.city},{' '}
                  {order.shippingAddress.province} {order.shippingAddress.postalCode}
                </span>
              </a>
            ) : (
              <>
                {order.shippingAddress.line1 && <p className="text-ink-2">{order.shippingAddress.line1}</p>}
                <p className="text-ink-2">
                  {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
                  {order.shippingAddress.postalCode}
                </p>
              </>
            )}
            {order.shippingAddress.phone && isRiderOfOrder ? (
              <a
                href={`tel:${order.shippingAddress.phone}`}
                className="flex items-center gap-2 self-start font-mono text-ink-2 underline-offset-2 hover:text-accent-ink hover:underline"
              >
                <Phone size={16} className="shrink-0" aria-hidden="true" />
                {order.shippingAddress.phone}
              </a>
            ) : order.shippingAddress.phone ? (
              <p className="font-mono text-ink-2">{order.shippingAddress.phone}</p>
            ) : (
              <p className="text-[13px] text-ink-3">
                {isSellerOfOrder
                  ? 'The rider delivers, so only they see the street and phone number.'
                  : 'The street and phone number are hidden once an order is finished.'}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-[13px] font-medium text-ink-3">Payment</h2>
            <p>{PAYMENT_LABELS[order.paymentMethod]}</p>
          </div>
          <PaymentNote order={order} isCustomer={isCustomer} />
          {!isRiderOfOrder && <RiderCard order={order} isCustomer={isCustomer} isAdmin={canManageRiders} />}
          <DeliveryProof order={order} />
          {!isCustomer && !isRiderOfOrder && order.user && (
            <div className="flex flex-col gap-1">
              <h2 className="text-[13px] font-medium text-ink-3">Customer</h2>
              <p>{order.user.name}</p>
              {order.user.email && <p className="text-ink-2">{order.user.email}</p>}
            </div>
          )}
        </aside>
      </div>

      {!isRiderOfOrder && (
        <ReturnsPanel order={order} isCustomer={isCustomer} isSellerOfOrder={isSellerOfOrder} />
      )}
    </div>
  );
}
