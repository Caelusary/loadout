import { Link } from 'react-router';
import { OrderStatus, Price } from '../../components/ui/chips.jsx';
import { formatDate, orderNumber } from '../../lib/format.js';

export const itemSummary = (order) => {
  const [first, ...rest] = order.items;
  return rest.length ? `${first.name} and ${rest.length} more` : first.name;
};

// Used by the customer's order history.
export function OrderRow({ order }) {
  return (
    <Link
      to={`/orders/${order._id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-panel border border-seam p-4 transition-colors hover:border-edge"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate font-medium">{itemSummary(order)}</p>
        <p className="text-[13px] text-ink-3">
          <span className="font-mono">{orderNumber(order._id)}</span>, {order.seller?.sellerProfile?.shopName ?? 'Shop'},{' '}
          {formatDate(order.createdAt)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <OrderStatus order={order} />
        <Price cents={order.totalCents} className="font-medium" />
      </div>
    </Link>
  );
}
