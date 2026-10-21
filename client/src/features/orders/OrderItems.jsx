import { Link } from 'react-router';
import { Price, Tag } from '../../components/ui/chips.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { formatMoney } from '../../lib/format.js';

// The order's lines and totals. Reviewing happens in the "How did it go?" box at the top; here a line only says it's
// been reviewed.
export function OrderItems({ order, isCustomer }) {
  return (
    <section aria-label="Items">
      <ul className="divide-y divide-seam border-y border-seam">
        {order.items.map((item) => (
          <li key={item.product} className="flex items-center gap-4 py-4">
            <ProductImage src={item.image} className="size-16 shrink-0 rounded-control" size={160} />
            <div className="flex min-w-0 flex-1 flex-col">
              {item.slug ? (
                <Link to={`/p/${item.slug}`} data-cursor-skip className="line-clamp-2 w-fit font-medium">
                  {item.name}
                </Link>
              ) : (
                <p className="line-clamp-2 font-medium">{item.name}</p>
              )}
              <p className="font-mono text-[13px] text-ink-3 tabular-nums">
                {item.qty} × {formatMoney(item.priceCents)}
              </p>
            </div>
            <Price cents={item.priceCents * item.qty} className="font-medium" />
            {isCustomer && order.reviewedProducts?.includes(item.product) && <Tag tone="ok">Reviewed</Tag>}
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
          <dd className="font-mono tabular-nums">
            {order.shippingCents === 0 ? 'Free' : formatMoney(order.shippingCents)}
          </dd>
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
  );
}
