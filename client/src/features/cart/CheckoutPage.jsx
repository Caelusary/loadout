import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AddressFields } from '../../components/AddressFields.jsx';
import { Page } from '../../components/layout/Page.jsx';
import { PageSpinner } from '../../components/layout/guards.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, FormError } from '../../components/ui/feedback.jsx';
import { Checkbox, RadioCards } from '../../components/ui/fields.jsx';
import { DiscountField } from './DiscountField.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { PAYMENT_LABELS, PAYMENT_METHODS } from '../../lib/constants.js';
import { formatMoney } from '../../lib/format.js';
import { addressSchema, emptyAddress } from '../../lib/schemas.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useCart } from '../../providers/CartProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { OrderSummary } from './CartPage.jsx';
import { useCartLines } from './useCartLines.js';

const schema = z.object({
  shippingAddress: addressSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Choose how you want to pay' }) }),
  saveAddress: z.boolean(),
});

const PAYMENT_OPTIONS = [
  { value: 'cod', label: PAYMENT_LABELS.cod, description: 'Pay the courier when it arrives.' },
  { value: 'mock-card', label: PAYMENT_LABELS['mock-card'], description: 'No card details are collected. For the demo.' },
];

export default function CheckoutPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const cart = useCart();
  // ?buy=<productId>&qty=<n> is a "Buy now" checkout: just that item, and the cart is left alone.
  const [params] = useSearchParams();
  const buyId = params.get('buy');
  const buyQty = Math.max(1, Number.parseInt(params.get('qty'), 10) || 1);
  const buyNow = Boolean(buyId);
  const buyItems = useMemo(() => (buyId ? [{ productId: buyId, qty: buyQty }] : null), [buyId, buyQty]);
  const items = buyItems ?? cart.items;
  const summary = useCartLines(buyItems ?? undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState('');
  const [placed, setPlaced] = useState(false);
  // One id for this checkout, resent on any retry, so the server places the order only once.
  const [checkoutId] = useState(() => crypto.randomUUID());
  // { code, discountCents, cartKey } once a code is applied; cartKey is the cart it was priced for.
  const [discount, setDiscount] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      shippingAddress: { ...emptyAddress, fullName: user.name, ...user.shippingAddress },
      paymentMethod: 'cod',
      saveAddress: !user.shippingAddress,
    },
  });

  if (!buyNow && !cart.ready) return <PageSpinner />;
  if (!buyNow && !placed && cart.items.length === 0) return <Navigate to="/cart" replace />;
  if (summary.isPending) return <PageSpinner />;
  // Without live prices every line would read as unavailable, so show the failure instead of a dead form.
  if (summary.isError && !summary.data) {
    return (
      <Page title="Checkout">
        <ErrorState error={summary.error} onRetry={summary.refetch} />
      </Page>
    );
  }

  // A preview is only good for the cart it priced. If the cart changes (another tab) or a price
  // refreshes, drop it rather than show a stale saving; the server re-prices at checkout anyway.
  const cartKey = `${JSON.stringify(items)}:${summary.subtotalCents}`;
  const activeDiscount = discount?.cartKey === cartKey ? discount : null;
  const staleDiscount = Boolean(discount) && !activeDiscount;

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          checkoutId,
          ...(buyNow ? { buyNow: true } : { fromCart: true }),
          items,
          ...values,
          ...(activeDiscount && { couponCode: activeDiscount.code }),
        },
      });
      setPlaced(true);
      if (!buyNow) cart.checkedOut();
      // The order went through either way; only claim the address was saved if the server says so.
      if (values.saveAddress && res.addressSaved) setUser({ ...user, shippingAddress: values.shippingAddress });
      else if (values.saveAddress) toast.error("Order placed, but your address couldn't be saved to your account.");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/order-confirmed/${res.checkoutId}`, { replace: true });
    } catch (err) {
      if (err.code === 'COUPON_INVALID') {
        // The code stopped working between applying it and placing the order (used up or expired).
        setDiscount(null);
        setDiscountError(err.message);
      } else if (err.code === 'CART_CHANGED') {
        cart.refetch();
        setFormError(err.message);
      } else if (['OUT_OF_STOCK', 'UNAVAILABLE', 'OWN_PRODUCT'].includes(err.code)) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        setFormError(`${err.message} ${buyNow ? 'Go back to the product and try again.' : 'Update your cart and try again.'}`);
      } else if (!applyServerErrors(err, setError)) {
        setFormError(err.message);
      }
    }
  });

  return (
    <Page title="Checkout">
      <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-10">
          <FormError message={formError} />
          <section className="flex flex-col gap-4">
            <h2 className="wide text-lg font-bold">Shipping address</h2>
            <AddressFields register={register} errors={errors.shippingAddress} prefix="shippingAddress" />
            <Checkbox label="Save this address to my account" {...register('saveAddress')} />
          </section>
          <section>
            <Controller
              control={control}
              name="paymentMethod"
              render={({ field }) => (
                <RadioCards
                  legend="Payment"
                  name="paymentMethod"
                  options={PAYMENT_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.paymentMethod?.message}
                />
              )}
            />
          </section>
        </div>
        <OrderSummary {...summary} discount={activeDiscount}>
          <DiscountField
            items={items}
            applied={activeDiscount}
            error={discountError || (staleDiscount ? 'Your order changed. Apply the code again.' : '')}
            onError={(message) => {
              setDiscountError(message);
              if (!message && staleDiscount) setDiscount(null);
            }}
            onApply={(applied) => setDiscount(applied && { ...applied, cartKey })}
          />
          <ul className="flex flex-col gap-3 border-t border-seam pt-4 text-sm">
            {summary.groups.map((g) => (
              <li key={g.sellerId} className="flex flex-col gap-1">
                <p className="text-[13px] text-ink-3">{g.shopName}</p>
                {g.lines.map((l) => (
                  <p key={l.productId} className="flex justify-between gap-3">
                    <span className="truncate text-ink-2">
                      {l.qty} × {l.product?.name ?? 'Unavailable item'}
                    </span>
                    <span className="font-mono tabular-nums">{formatMoney(l.lineCents)}</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isSubmitting}
            disabled={summary.hasProblems || (!buyNow && cart.saving)}
          >
            Place order
          </Button>
          {summary.hasProblems && (
            <p className="text-[13px] text-warn">
              {buyNow ? "This item can't be bought right now." : 'Your cart has items that need attention.'}
            </p>
          )}
        </OrderSummary>
      </form>
    </Page>
  );
}
