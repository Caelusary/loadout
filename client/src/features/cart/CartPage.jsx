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
    <li className="grid grid-cols-[auto_64px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 py-4 sm:grid-cols-[auto_80px_minmax(0,1fr)_auto] sm:gap-x-4">
      <label className="grid size-11 cursor-pointer place-items-center self-center sm:size-10">
        <input
          type="checkbox"
          checked={line.checked}
          onChange={(e) => cart.setChecked(line.productId, e.target.checked)}
          aria-label={`Check out ${product?.name ?? 'this item'}`}
          className="size-[18px] accent-accent-ink"
        />
      </label>
      <ProductImage src={image?.url} className={`size-16 rounded-control sm:size-20 ${line.checked ? '' : 'opacity-50'}`} size={160} />
      <div className={`flex min-w-0 flex-col gap-1 ${line.checked ? '' : 'opacity-70'}`}>
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
          <p className="text-[13px] text-bad">No longer available. Remove or untick it to check out.</p>
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
      <div className="col-span-2 col-start-2 flex items-center justify-between gap-4 sm:col-span-1 sm:col-start-auto sm:justify-end">
        {line.available && (
          <QtyStepper
            value={line.qty}
            onChange={(qty) => cart.setQty(line.productId, qty)}
            max={Math.min(product.stock, MAX_QTY)}
          />
        )}
        <Price cents={line.lineCents} className={`w-24 text-right font-medium ${line.checked ? 'text-ink' : 'text-ink-3'}`} />
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

export function OrderSummary({ groups, shopCount = groups.length, subtotalCents, shippingCents, totalCents, discount, children }) {
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
          <dt className="text-ink-2">Shipping{shopCount > 1 ? ` (${shopCount} shops)` : ''}</dt>
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
  // Every line is listed; only the ticked ones are totalled and go to checkout.
  const summary = useCartLines(undefined, { isChecked: cart.isChecked });
  const allChecked = cart.selected.length === cart.items.length;

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
          <div className="flex flex-col gap-6">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-seam pb-3 text-sm text-ink-2">
              <span className="grid size-11 place-items-center sm:size-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && cart.selected.length > 0;
                  }}
                  onChange={(e) => cart.setAllChecked(e.target.checked)}
                  className="size-[18px] accent-accent-ink"
                />
              </span>
              Select all ({cart.items.length})
            </label>
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
            {summary.shopCount > 1 && (
              <p className="text-[13px] text-ink-3">
                Each shop ships its own items, so this becomes {summary.shopCount} orders.
              </p>
            )}
            {summary.checkedCount === 0 ? (
              <p className="text-[13px] text-ink-3">Tick the items you want to check out.</p>
            ) : summary.hasProblems ? (
              <p className="text-[13px] text-warn">Fix or untick the highlighted items to check out.</p>
            ) : (
              <ButtonLink to="/checkout" size="lg" className="w-full">
                Check out ({summary.checkedCount})
              </ButtonLink>
            )}
          </OrderSummary>
        </div>
      )}
    </Page>
  );
}
