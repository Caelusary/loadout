import { Trash } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { Page } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Price } from '../../components/ui/chips.jsx';
import { QtyStepper } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { FREE_SHIPPING_MIN_CENTS, MAX_QTY } from '../../lib/constants.js';
import { formatMoney } from '../../lib/format.js';
import { useCart } from '../../providers/CartProvider.jsx';
import { useCartLines } from './useCartLines.js';

function CartLine({ line }) {
  const cart = useCart();
  const { product } = line;
  const image = product?.images?.[0];
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[80px_minmax(0,1fr)_auto]">
      <ProductImage src={image?.url} className="size-16 rounded-control sm:size-20" size={160} />
      <div className="flex min-w-0 flex-col gap-1">
        {line.available ? (
          <Link to={`/p/${product.slug}`} className="truncate font-medium text-ink hover:text-accent-ink">
            {product.name}
          </Link>
        ) : (
          <p className="truncate font-medium text-ink-3">{product?.name ?? 'Removed product'}</p>
        )}
        {line.available ? (
          <Price cents={product.priceCents} was={product.compareAtCents} className="text-[13px] text-ink-3" />
        ) : (
          <p className="text-[13px] text-bad">No longer available. Remove it to check out.</p>
        )}
        {line.overStock && (
          <p className="text-[13px] text-warn">Only {product.stock} left. Lower the quantity.</p>
        )}
        {line.available && line.addedPriceCents != null && line.addedPriceCents !== product.priceCents && (
          <p className={`flex flex-wrap items-center gap-x-2 text-[13px] ${product.priceCents > line.addedPriceCents ? 'text-warn' : 'text-ok'}`}>
            {product.priceCents > line.addedPriceCents ? 'Price went up' : 'Price dropped'} from {formatMoney(line.addedPriceCents)} since
            you added it.
            <button
              type="button"
              className="font-medium text-accent-ink hover:underline"
              onClick={() => cart.acknowledgePrice(line.productId, line.qty)}
            >
              OK
            </button>
          </p>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:justify-end">
        {line.available && (
          <QtyStepper
            value={line.qty}
            onChange={(qty) => cart.setQty(line.productId, qty)}
            max={Math.min(product.stock, MAX_QTY)}
          />
        )}
        <Price cents={line.lineCents} className="w-24 text-right font-medium text-ink" />
        <button
          type="button"
          onClick={() => cart.remove(line.productId)}
          aria-label={`Remove ${product?.name ?? 'item'}`}
          className="grid size-10 place-items-center rounded-control text-ink-3 transition-colors hover:bg-raised hover:text-bad"
        >
          <Trash size={18} />
        </button>
      </div>
    </li>
  );
}

export function OrderSummary({ groups, subtotalCents, shippingCents, totalCents, discount, children }) {
  const discountCents = discount?.discountCents ?? 0;
  return (
    <aside className="flex flex-col gap-4 rounded-panel border border-seam bg-plate p-5 lg:sticky lg:top-24">
      <h2 className="wide text-lg font-bold">Summary</h2>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-2">Subtotal</dt>
          <dd className="font-mono tabular-nums">{formatMoney(subtotalCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-2">Shipping{groups.length > 1 ? ` (${groups.length} shops)` : ''}</dt>
          <dd className="font-mono tabular-nums">
            {shippingCents === 0 ? 'Free' : formatMoney(shippingCents)}
          </dd>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between text-ok">
            <dt>Discount ({discount.code})</dt>
            <dd className="font-mono tabular-nums">−{formatMoney(discountCents)}</dd>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-seam pt-3 text-base">
          <dt className="font-medium">Total</dt>
          <dd className="font-mono font-medium tabular-nums">
            {formatMoney(Math.max(0, totalCents - discountCents))}
          </dd>
        </div>
      </dl>
      {children}
    </aside>
  );
}

export default function CartPage() {
  const cart = useCart();
  const summary = useCartLines();

  return (
    <Page title="Cart">
      {!cart.ready ? (
        <Skeleton className="h-20" />
      ) : cart.error ? (
        <ErrorState error={cart.error} onRetry={cart.refetch} title="Your cart didn't load" />
      ) : cart.items.length === 0 ? (
        <EmptyState title="Your cart is empty" action={<ButtonLink to="/shop">Browse products</ButtonLink>}>
          Items you add are saved to your account, on every device you sign in on.
        </EmptyState>
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={summary.refetch} />
      ) : summary.isPending ? (
        <div className="flex flex-col gap-4">
          {cart.items.map((i) => (
            <Skeleton key={i.productId} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-8">
            {summary.groups.map((g) => {
              const toFree = FREE_SHIPPING_MIN_CENTS - g.subtotalCents;
              return (
                <section key={g.sellerId} aria-label={g.shopName}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-seam pb-3">
                    <h2 className="font-medium">{g.shopName}</h2>
                    {g.subtotalCents > 0 && (
                      <p className="text-[13px] text-ink-3">
                        {toFree > 0
                          ? `Add ${formatMoney(toFree)} from this shop for free shipping`
                          : 'Free shipping from this shop'}
                      </p>
                    )}
                  </div>
                  <ul className="divide-y divide-seam">
                    {g.lines.map((line) => (
                      <CartLine key={line.productId} line={line} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <OrderSummary {...summary}>
            {summary.groups.length > 1 && (
              <p className="text-[13px] text-ink-3">
                Each shop ships its own items, so this becomes {summary.groups.length} orders.
              </p>
            )}
            {summary.hasProblems ? (
              <p className="text-[13px] text-warn">Fix the highlighted items to check out.</p>
            ) : (
              <ButtonLink to="/checkout" size="lg" className="w-full">
                Check out
              </ButtonLink>
            )}
          </OrderSummary>
        </div>
      )}
    </Page>
  );
}
