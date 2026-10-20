import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { CardsSkeleton, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { DECLINE_REASON_LABELS, VEHICLE_LABELS } from '../../lib/constants.js';
import { formatDate, orderNumber, vehicleText } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { FeedbackItem, RiderStatus } from './riderParts.jsx';

function Fact({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

// Pause or clear a rider. Both need a note, which goes in the activity log. Deactivating stays on the Users page.
function HoldControl({ rider }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const held = Boolean(rider.riderProfile?.heldAt);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const close = () => {
    setOpen(false);
    setNote('');
  };
  const change = useMutation({
    mutationFn: () =>
      api(`/admin/riders/${rider._id}/hold`, {
        method: 'PATCH',
        body: { action: held ? 'clear' : 'hold', note },
      }),
    onSuccess: () => {
      toast.show(held ? `${rider.name} is back on deliveries` : `${rider.name} is paused`);
      queryClient.invalidateQueries({ queryKey: ['admin'] }); // this page, the Users list and the menu counts
      close();
    },
    onError: (err) => toast.error(err.fields?.note ?? err.message),
  });

  return (
    <>
      <Button
        variant={held ? 'primary' : 'secondary'}
        onClick={() => setOpen(true)}
        disabled={!rider.isActive}
      >
        {held ? 'Clear and resume deliveries' : 'Pause new deliveries'}
      </Button>
      <ConfirmDialog
        open={open}
        title={held ? `Put ${rider.name} back on deliveries?` : `Pause ${rider.name}?`}
        confirmLabel={held ? 'Clear' : 'Pause'}
        cancelLabel="Back"
        tone={held ? 'primary' : 'danger'}
        pending={change.isPending}
        onConfirm={() => (note.trim().length < 3 ? toast.error('Add a short note first.') : change.mutate())}
        onClose={close}
      >
        <p>
          {held
            ? 'New orders will go to them again. Only do this once you have looked into the report.'
            : "They won't get new orders, and ones they haven't picked up go to other riders. Orders already out carry on."}{' '}
          The note goes in the activity log.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="Note"
            rows={3}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

// A rider asked to change the vehicle and plate buyers look for. Approving waits while they have an order out, so
// those buyers still see what they were told; turning it down can carry a reason, which the rider is sent.
function VehicleRequest({ rider, onTheWay }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const p = rider.riderProfile;
  const ask = p.vehicleRequest;
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (action) =>
      api(`/admin/riders/${rider._id}/vehicle-request`, { method: 'PATCH', body: { action, note } }),
    onSuccess: (_, action) => {
      toast.show(
        action === 'approve' ? `${rider.name} now delivers with ${vehicleText(ask)}` : 'Request turned down',
      );
      queryClient.invalidateQueries({ queryKey: ['admin'] }); // the rider, the queue and the menu count
      setRejecting(false);
      setNote('');
    },
    onError: (err) => toast.error(err.message),
  });
  const busy = onTheWay > 0;

  return (
    <section
      aria-label="Vehicle change"
      className="mb-8 flex flex-col gap-3 rounded-panel border border-accent-ink/40 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">Vehicle change requested {formatDate(ask.at)}</p>
        <p className="text-ink-2">
          <span className="font-mono">{vehicleText(p)}</span> →{' '}
          <span className="font-mono text-ink">{vehicleText(ask)}</span>
        </p>
        {busy && (
          <p className="text-[13px] text-ink-3">
            They have {onTheWay === 1 ? 'an order' : `${onTheWay} orders`} out right now. Approve once
            delivered, so those buyers see the vehicle they were told.
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={() => setRejecting(true)}>
          Turn down
        </Button>
        <Button
          onClick={() => decide.mutate('approve')}
          loading={decide.isPending && decide.variables === 'approve'}
          disabled={busy}
        >
          Approve
        </Button>
      </div>
      <ConfirmDialog
        open={rejecting}
        title="Turn down this vehicle change?"
        confirmLabel="Turn down"
        cancelLabel="Back"
        tone="danger"
        pending={decide.isPending}
        onConfirm={() => decide.mutate('reject')}
        onClose={() => setRejecting(false)}
      >
        <p>
          {rider.name} keeps delivering with {vehicleText(p)}. They're told it wasn't approved, with your
          reason if you add one.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="Reason"
            optional
            rows={3}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}

export default function AdminRiderDetail() {
  const { id } = useParams();
  const { can } = useAuth(); // orders open only for admins who manage them
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'riders', id],
    queryFn: ({ signal }) => api(`/admin/riders/${id}`, { signal }),
  });
  useTitle(data?.rider.name ?? 'Rider');

  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  // Loading, shaped like the page: name and email, the facts box with its button, then the ratings list.
  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="mb-3 h-8 w-48" />
        <Skeleton className="mb-8 h-4 w-40" />
        <div className="mb-8 flex flex-col gap-4 rounded-panel border border-seam bg-plate p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-11 w-44" />
        </div>
        <Skeleton className="mb-3 h-5 w-48" />
        <CardsSkeleton count={2} lines={1} />
      </div>
    );
  }
  const { rider, stats, feedback, declines } = data;
  const p = rider.riderProfile ?? {};

  return (
    <>
      <PanelHeader title={rider.name} description={rider.email} />
      {p.vehicleRequest && <VehicleRequest rider={rider} onTheWay={stats.onTheWay} />}
      <div className="mb-8 flex flex-col gap-4 rounded-panel border border-seam bg-plate p-4 sm:flex-row sm:items-start sm:justify-between">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <Fact label="Status">
            <RiderStatus rider={rider} />
          </Fact>
          <Fact label="Phone">{p.phone ? <span className="font-mono">{p.phone}</span> : '—'}</Fact>
          <Fact label="Vehicle">
            {p.vehicle ? VEHICLE_LABELS[p.vehicle] : '—'}
            {p.plate && <span className="ml-2 font-mono text-ink-2">{p.plate}</span>}
          </Fact>
          <Fact label="Rating">
            {stats.ratingAvg == null
              ? 'No ratings yet'
              : `${stats.ratingAvg.toFixed(1)} from ${stats.ratingCount}`}
          </Fact>
          <Fact label="Delivered">{stats.delivered}</Fact>
          <Fact label="Upheld “not received” reports">{stats.upheldDeliveryReports}</Fact>
        </dl>
        <HoldControl rider={rider} />
      </div>
      {p.heldAt && (
        <p className="mb-8 rounded-panel border border-warn/50 bg-warn/5 px-4 py-3 text-sm text-ink-2">
          Paused since {formatDate(p.heldAt)}
          {p.heldReason && `: ${p.heldReason}`}.
        </p>
      )}

      <section aria-labelledby="feedback-heading" className="mb-10 flex flex-col gap-3">
        <h2 id="feedback-heading" className="font-medium">
          Every rating and report ({feedback.length})
        </h2>
        {feedback.length === 0 ? (
          <p className="text-sm text-ink-3">No buyer has rated or reported this rider yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {feedback.map((item) => (
              <FeedbackItem key={item._id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="declines-heading" className="flex flex-col gap-3">
        <h2 id="declines-heading" className="font-medium">
          Orders turned down ({declines.length})
        </h2>
        {declines.length === 0 ? (
          <p className="text-sm text-ink-3">None.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-seam rounded-panel border border-seam text-sm">
            {declines.map((d) => (
              <li
                key={`${d.order}-${d.at}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3"
              >
                {can('orders') ? (
                  <Link to={`/orders/${d.order}`} data-cursor-skip className="font-mono">
                    {orderNumber(d.order)}
                  </Link>
                ) : (
                  <span className="font-mono">{orderNumber(d.order)}</span>
                )}
                <span>{DECLINE_REASON_LABELS[d.reason]}</span>
                {d.note && <span className="text-ink-2">&ldquo;{d.note}&rdquo;</span>}
                <span className="ml-auto text-[13px] text-ink-3">{formatDate(d.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
