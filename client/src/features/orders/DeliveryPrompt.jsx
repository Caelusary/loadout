import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../../lib/api.js';
import { orderNumber } from '../../lib/format.js';
import { RatingInput } from '../../components/ui/controls.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { ReceiptActions } from './DeliveryCheck.jsx';

const LATER = 'loadout:receipt-later'; // order ids put off for this browser session

const readLater = () => {
  try {
    return JSON.parse(sessionStorage.getItem(LATER) ?? '[]');
  } catch {
    return [];
  }
};

// Asks "did it arrive?" about a delivered order the next time its buyer is in the app. It's a strip under the header,
// where a question gets read (a corner card reads as a toast and gets ignored), and it moves the page down instead of
// covering it, so it never sits on the buy bar, the cart or another card. It doesn't block anything: "Later" hides it
// for the session, it comes back next visit, and after 7 days the server stops asking and the order counts as received.
export function DeliveryPrompt() {
  const { user, canShop } = useAuth();
  const { pathname } = useLocation();
  const [later, setLater] = useState(readLater);
  const [thanks, setThanks] = useState(null); // the order, after "Yes, I got it"
  const { data } = useQuery({
    queryKey: ['orders', 'awaiting-receipt'],
    queryFn: ({ signal }) => api('/orders/mine?awaiting=receipt', { signal }).then((r) => r.items),
    enabled: Boolean(user && canShop),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const waiting = data?.filter((o) => !later.includes(o._id)) ?? [];
  const order = waiting[0];
  // Not on an order page (it asks about its own order, and a question about another one would compete with it), the
  // sign-in forms, or while paying.
  if ((!order && !thanks) || /^\/(login|register|checkout|forgot-password|reset-password)/.test(pathname))
    return null;
  if (!thanks && pathname.startsWith('/orders/')) return null;

  const putOff = (id) => {
    const next = [...new Set([...later, id])];
    setLater(next);
    try {
      sessionStorage.setItem(LATER, JSON.stringify(next));
    } catch {
      // Not remembered; it just asks again on the next page.
    }
  };

  return (
    <section aria-label="Delivery check" className="border-b border-accent-ink/40 bg-accent/10">
      <div className="mx-auto flex w-full max-w-[1280px] items-start gap-3 px-4 py-3 sm:px-6 lg:items-center">
        <Package size={22} className="mt-2.5 shrink-0 text-accent-ink lg:mt-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          {thanks ? (
            <>
              <p className="py-2.5 text-sm text-ink-2 lg:py-0">
                <span className="font-medium text-ink">Glad it arrived.</span> Want to review what you got?
              </p>
              {thanks.rider && <RateRiderNow order={thanks} />}
              <div className="flex gap-2">
                <Link
                  to={`/orders/${thanks._id}?review=1`}
                  onClick={() => setThanks(null)}
                  className="inline-flex h-11 items-center rounded-control bg-accent px-4 text-sm font-medium text-on-accent"
                >
                  Write reviews
                </Link>
                <button
                  type="button"
                  onClick={() => setThanks(null)}
                  className="h-11 rounded-control px-3 text-sm text-ink-2 hover:text-ink"
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="pt-2.5 text-sm text-ink-2 lg:pt-0">
                <span className="font-medium text-ink">Did order {orderNumber(order._id)} arrive?</span>{' '}
                {order.seller?.sellerProfile?.shopName ? `From ${order.seller.sellerProfile.shopName}. ` : ''}
                The rider marked it delivered.
                {waiting.length > 1 && (
                  <span className="text-ink-3"> ({waiting.length - 1} more waiting)</span>
                )}
              </p>
              <ReceiptActions order={order} onDone={(kind) => kind === 'received' && setThanks(order)} />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => (thanks ? setThanks(null) : putOff(order._id))}
          aria-label={thanks ? 'Dismiss' : 'Ask me later'}
          title={thanks ? 'Dismiss' : 'Ask me later'}
          className="-m-1 grid size-10 shrink-0 place-items-center rounded-control text-ink-3 hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  );
}

// One tap to rate the rider while the delivery is fresh; the order page keeps the same stars (with a comment box)
// for anyone who skips it here. Nothing is required: a rating someone was forced into says little.
function RateRiderNow({ order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const rate = useMutation({
    mutationFn: (n) => api(`/orders/${order._id}/rider-rating`, { method: 'POST', body: { stars: n } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', order._id] }),
    onError: (err) => {
      setStars(0);
      toast.error(err.message);
    },
  });
  if (rate.isSuccess) {
    return (
      <p className="text-sm text-ink-2">
        Thanks, you gave {order.rider.name} {stars} star{stars === 1 ? '' : 's'}.
      </p>
    );
  }
  return (
    <RatingInput
      label={`How was ${order.rider.name}, your rider?`}
      value={stars}
      disabled={rate.isPending}
      onChange={(n) => {
        setStars(n);
        rate.mutate(n);
      }}
    />
  );
}
