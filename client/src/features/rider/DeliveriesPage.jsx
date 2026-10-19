import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, MapPin, Phone, WarningCircle } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { OrderStatus } from '../../components/ui/chips.jsx';
import { ProductImage } from '../../components/ui/ProductImage.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import {
  ATTEMPT_REASON_LABELS,
  RIDER_NEXT as NEXT,
  RIDER_NEXT_LABEL as NEXT_LABEL,
  STATUS_LABELS,
} from '../../lib/constants.js';
import { formatDate, formatMoney, orderNumber, plural } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { DeclineDelivery } from './DeclineDelivery.jsx';
import { MarkDelivered } from './MarkDelivered.jsx';
import { MissedDelivery } from './MissedDelivery.jsx';
import { HoldNotice } from './RiderProfilePage.jsx';
import { useRiderProfile } from './useRiderProfile.js';

const VIEWS = [
  ['active', 'To deliver'],
  ['done', 'Done'],
];
const shortDay = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
// A search link opens the address in the phone's maps app (or Google Maps in a browser).
const mapsLink = (to) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${to.line1}, ${to.city}, ${to.province} ${to.postalCode}`)}`;
const lastAt = (o, status) => [...(o.statusHistory ?? [])].reverse().find((h) => h.status === status)?.at;

// The buyer is away and picked a later day for the next try.
const retryLater = (o) => Boolean(o.retryOn) && new Date(o.retryOn) > new Date();

// How the money went, said the way it reads once the order is done.
function paymentLine(o) {
  if (o.paymentMethod !== 'cod') return 'Paid online';
  if (o.status === 'delivered') return `Paid ${formatMoney(o.totalCents)} in cash`;
  if (o.status === 'cancelled') return 'Cash on delivery';
  return `Collect ${formatMoney(o.totalCents)} cash`;
}

// A rider's run sheet: who to bring each parcel to, and one tap per step. Laid out for a phone.
export default function DeliveriesPage() {
  useTitle('Deliveries');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useRiderProfile();
  // The tab and page live in the address, so a reload or Back returns to the same list.
  const [search, setSearch] = useSearchParams();
  const view = search.get('view') === 'done' ? 'done' : 'active';
  const page = Math.max(1, Number(search.get('page')) || 1);
  const go = (next) =>
    setSearch(
      Object.fromEntries(
        Object.entries({
          view: next.view === 'done' ? 'done' : null,
          page: next.page > 1 ? next.page : null,
        }).filter(([, v]) => v),
      ),
      { replace: true },
    );
  const setPage = (p) => go({ view, page: p });
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
      <p className="mt-1 text-sm text-ink-2">
        Shops hand orders to you when they mark them ready for pickup. Oldest first. You can turn one down
        until you pick it up.
      </p>

      {profile?.held && (
        <div className="mt-4">
          <HoldNotice held />
        </div>
      )}
      <div role="tablist" aria-label="Deliveries" className="mt-6 mb-5 flex gap-1">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => {
              go({ view: value, page: 1 });
            }}
            className="h-9 rounded-control px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
          >
            {label}
            {data?.counts && <span className="ml-1.5 font-mono text-ink-3">{data.counts[value]}</span>}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <DeliveriesSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyState title={view === 'active' ? 'Nothing to deliver' : 'No deliveries yet'}>
          {view === 'active'
            ? 'New deliveries show up here when a shop ships an order to you.'
            : 'Orders you deliver show up here.'}
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
                    <Link
                      to={`/orders/${o._id}`}
                      className="font-mono text-[15px] font-medium hover:text-accent-ink"
                    >
                      {orderNumber(o._id)}
                    </Link>
                    <OrderStatus order={o} refunds={false} />
                  </div>
                  <div className="flex items-start gap-4">
                    <Parcel items={o.items} />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      {to.line1 ? (
                        <div className="flex flex-col gap-1.5 text-sm">
                          <span className="font-medium">{to.fullName}</span>
                          <a
                            href={mapsLink(to)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="-my-1 flex items-start gap-2 py-1 text-ink-2 underline-offset-2 hover:text-accent-ink hover:underline"
                          >
                            <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            {to.line1}, {to.city}, {to.province} {to.postalCode}
                          </a>
                          <a
                            href={`tel:${to.phone}`}
                            className="-my-1 flex items-center gap-2 self-start py-1 font-mono text-ink-2 underline-offset-2 hover:text-accent-ink hover:underline"
                          >
                            <Phone size={16} className="shrink-0" aria-hidden="true" />
                            {to.phone}
                          </a>
                        </div>
                      ) : (
                        // Finished orders keep only the city: the buyer's details are for delivering, not keeping.
                        <span className="flex items-start gap-2 text-sm text-ink-2">
                          <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                          {to.city}, {to.province}
                        </span>
                      )}
                      <p className="text-[13px] text-ink-3">
                        From {o.seller?.sellerProfile?.shopName ?? 'a shop'} ·{' '}
                        {plural(
                          o.items.reduce((n, i) => n + i.qty, 0),
                          'item',
                        )}{' '}
                        · {paymentLine(o)}
                        {view === 'done' &&
                          lastAt(o, o.status) &&
                          ` · ${STATUS_LABELS[o.status]} ${formatDate(lastAt(o, o.status))}`}
                      </p>
                    </div>
                  </div>
                  {next && o.attempts?.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-control border border-warn/40 bg-warn/5 px-3 py-2 text-[13px]">
                      <span className="flex items-center gap-1.5 font-medium text-warn">
                        <WarningCircle size={16} aria-hidden="true" />
                        Missed {shortDay.format(new Date(o.attempts.at(-1).at))}:{' '}
                        {ATTEMPT_REASON_LABELS[o.attempts.at(-1).reason]}. Last try left.
                      </span>
                      {retryLater(o) && (
                        <span className="flex items-center gap-1.5 text-ink-2">
                          <CalendarBlank size={16} aria-hidden="true" />
                          The buyer asked for {shortDay.format(new Date(o.retryOn))}.
                        </span>
                      )}
                    </div>
                  )}
                  {next && (
                    <div className="flex flex-wrap gap-2">
                      {next === 'delivered' ? (
                        <>
                          <MarkDelivered order={o} />
                          <MissedDelivery order={o} />
                        </>
                      ) : (
                        <Button
                          className="max-sm:w-full"
                          variant="secondary"
                          disabled={retryLater(o)}
                          loading={advance.isPending && advance.variables?.id === o._id}
                          onClick={() => advance.mutate({ id: o._id, next })}
                        >
                          {retryLater(o)
                            ? `Out for delivery on ${shortDay.format(new Date(o.retryOn))}`
                            : NEXT_LABEL[next]}
                        </Button>
                      )}
                      {o.status === 'shipped' && !o.attempts?.length && <DeclineDelivery order={o} />}
                    </div>
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

// What's in the parcel, so the rider can match it at pickup: the first item's photo, with a count when there's more.
function Parcel({ items }) {
  const [first] = items;
  const more = items.reduce((n, i) => n + i.qty, 0) - 1;
  if (!first) return null;
  return (
    <div className="relative shrink-0">
      <ProductImage
        src={first.image}
        alt={first.name}
        className="size-20 rounded-control border border-seam bg-raised sm:size-24"
        size={200}
      />
      {more > 0 && (
        <span className="absolute -right-1.5 -bottom-1.5 rounded-full border border-seam bg-plate px-1.5 font-mono text-[11px] leading-5 text-ink-2 tabular-nums">
          +{more}
        </span>
      )}
    </div>
  );
}

// The list while it loads, shaped like its cards: order number and status, the parcel photo beside the buyer's
// name, address and phone, then the buttons.
function DeliveriesSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1].map((i) => (
        <li key={i} className="flex flex-col gap-3 rounded-panel border border-seam bg-plate p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <div className="flex items-start gap-4">
            <Skeleton className="size-20 shrink-0 rounded-control sm:size-24" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-28" />
          </div>
        </li>
      ))}
    </ul>
  );
}
