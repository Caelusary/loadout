import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { api, assetUrl } from '../../lib/api.js';
import { ATTEMPT_REASON_LABELS, MAX_ATTEMPTS } from '../../lib/constants.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const RETRY_WINDOW_DAYS = 14; // server/src/features/deliveries/attempts.js
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The rider's missed tries, with their photo at the door. While another try is coming, the buyer can pick a later day
// (away on a trip, out of town) or say they were home, which goes to the admins.
export function MissedAttempts({ order, isCustomer }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(order.retryOn ? isoDay(new Date(order.retryOn)) : '');
  const [disputing, setDisputing] = useState(false);
  const [tomorrow] = useState(() => new Date(Date.now() + DAY_MS)); // the earliest day to pick
  const attempts = order.attempts ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['order', order._id] });

  const retry = useMutation({
    mutationFn: (date) => api(`/orders/${order._id}/retry-day`, { method: 'PATCH', body: { date } }),
    onSuccess: (_, date) => {
      toast.show(
        date
          ? `The rider will come on ${formatDate(`${date}T00:00:00`)}`
          : 'The rider will come on the next run',
      );
      refresh();
    },
    onError: (err) => toast.error(err.fields?.date ?? err.message),
  });
  const dispute = useMutation({
    mutationFn: () => api(`/orders/${order._id}/attempt-dispute`, { method: 'POST' }),
    onSuccess: () => {
      toast.show('Thanks, an admin will look at it');
      setDisputing(false);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (attempts.length === 0) return null;
  const last = attempts.at(-1);
  const waiting = order.status === 'shipped';

  return (
    <section className="my-6 flex flex-col gap-4 rounded-panel border border-warn/40 bg-warn/5 p-4">
      <h2 className="flex items-center gap-2 font-medium text-warn">
        <WarningCircle size={18} aria-hidden="true" />
        {order.status === 'cancelled'
          ? `Couldn't be delivered after ${MAX_ATTEMPTS} tries`
          : waiting
            ? 'We missed you. The rider will try once more.'
            : `Missed ${attempts.length === 1 ? 'once' : `${attempts.length} times`} before`}
      </h2>
      <ul className="flex flex-col gap-3">
        {attempts.map((a) => (
          <li key={a.at} className="flex items-start gap-3 text-sm">
            <a href={assetUrl(a.photo)} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={assetUrl(a.photo)}
                alt="The rider's photo at the door"
                className="size-16 rounded-control border border-seam object-cover"
              />
            </a>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-ink">{ATTEMPT_REASON_LABELS[a.reason]}</span>
              <span className="text-[13px] text-ink-3">{formatDateTime(a.at)}</span>
              {a.note && <span className="text-ink-2">“{a.note}”</span>}
              {a.disputedAt && (
                <span className="self-start">
                  <Tag tone="warn">Buyer says they were home</Tag>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isCustomer && waiting && (
        <div className="flex flex-col gap-2 border-t border-warn/20 pt-4">
          <label htmlFor="retry-day" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <CalendarBlank size={16} aria-hidden="true" /> Away for a while? Pick the day you&apos;ll be home
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="retry-day"
              type="date"
              min={isoDay(tomorrow)}
              max={isoDay(new Date(tomorrow.getTime() + (RETRY_WINDOW_DAYS - 1) * DAY_MS))}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-10 rounded-control border border-edge bg-raised px-3 text-sm text-ink [color-scheme:dark] focus-visible:border-accent-ink"
            />
            <Button
              variant="secondary"
              disabled={!day || isoDay(new Date(order.retryOn ?? 0)) === day}
              loading={retry.isPending && retry.variables}
              onClick={() => retry.mutate(day)}
            >
              Save day
            </Button>
            {order.retryOn && (
              <Button
                variant="ghost"
                loading={retry.isPending && !retry.variables}
                onClick={() => {
                  setDay('');
                  retry.mutate(null);
                }}
              >
                Any day is fine
              </Button>
            )}
          </div>
          <p className="text-[13px] text-ink-3">
            {order.retryOn
              ? `The rider comes on ${formatDate(order.retryOn)}.`
              : `Without a day, the rider comes on the next run. Up to ${RETRY_WINDOW_DAYS} days ahead.`}
          </p>
        </div>
      )}

      {isCustomer && !last.disputedAt && order.status !== 'delivered' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
          Were you home when the rider came?
          <Button variant="ghost" size="sm" onClick={() => setDisputing(true)}>
            I was home
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={disputing}
        title="Tell us you were home?"
        confirmLabel="Send to an admin"
        cancelLabel="Never mind"
        tone="primary"
        pending={dispute.isPending}
        onConfirm={() => dispute.mutate()}
        onClose={() => setDisputing(false)}
      >
        <p>An admin compares the rider&apos;s photo with your address and follows up with the rider.</p>
      </ConfirmDialog>
    </section>
  );
}
