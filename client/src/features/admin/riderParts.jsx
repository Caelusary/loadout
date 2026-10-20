// Pieces the rider pages share: a rider's status tag, a star row, and one buyer rating or report (used in Complaints
// and on a rider's own page).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { api } from '../../lib/api.js';
import { RIDER_REPORT_LABELS } from '../../lib/constants.js';
import { formatDate, orderNumber } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={14}
          weight={i < value ? 'fill' : 'regular'}
          className={i < value ? 'text-accent-ink' : 'text-ink-3'}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function RiderStatus({ rider }) {
  if (!rider.isActive) return <Tag tone="bad">Deactivated</Tag>;
  if (rider.riderProfile?.heldAt) return <Tag tone="warn">Paused</Tag>;
  return <Tag tone="ok">Active</Tag>;
}

// One thing a buyer said about a rider. In the queue it carries the rider's name and a "Reviewed" button.
export function FeedbackItem({ item, showRider = false }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const { can } = useAuth();
  // A report pauses the rider, and closing it doesn't lift the pause on its own. Once it's off the queue nothing
  // points at the rider any more, so the choice is made here: keep them paused, or clear the report and resume them.
  const paused = Boolean(item.report && item.rider?.riderProfile?.heldAt);
  const review = useMutation({
    mutationFn: async ({ resume }) => {
      await api(`/admin/rider-feedback/${item._id}`, { method: 'PATCH', body: { note } });
      if (resume) {
        await api(`/admin/riders/${item.rider._id}/hold`, {
          method: 'PATCH',
          body: { action: 'clear', note: note.trim().length >= 3 ? note : 'Report reviewed' },
        });
      }
    },
    onSuccess: (_res, { resume }) => {
      toast.show(resume ? `Reviewed. ${item.rider.name} is back on deliveries` : 'Marked as reviewed');
      queryClient.invalidateQueries({ queryKey: ['admin'] }); // the list, the queue, the menu count and the rider
    },
    onError: (err) => toast.error(err.message),
  });
  const tone = item.report
    ? 'border-bad/50 bg-bad/5'
    : item.flagged && !item.reviewedAt
      ? 'border-warn/40'
      : 'border-seam';

  return (
    <li className={`flex flex-col gap-2 rounded-panel border p-4 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {showRider &&
          (item.rider ? (
            <Link to={`/admin/riders/${item.rider._id}`} data-cursor-skip className="font-medium">
              {item.rider.name}
            </Link>
          ) : (
            <span className="font-medium text-ink-3">Deleted rider</span>
          ))}
        {item.stars && <Stars value={item.stars} />}
        {item.report && <Tag tone="bad">Report: {RIDER_REPORT_LABELS[item.report.reason]}</Tag>}
        <span className="text-[13px] text-ink-3">
          {item.user?.name ?? 'A buyer'} ·{' '}
          {/* Orders open only for admins who manage them; for the rest the number is a reference. */}
          {can('orders') ? (
            <Link to={`/orders/${item.order}`} data-cursor-skip className="font-mono">
              {orderNumber(item.order)}
            </Link>
          ) : (
            <span className="font-mono">{orderNumber(item.order)}</span>
          )}{' '}
          · {formatDate(item.createdAt)}
        </span>
      </div>
      {item.report && <p className="text-ink">&ldquo;{item.report.note}&rdquo;</p>}
      {item.report && <RiderSide reply={item.riderReply} waiting={!item.reviewedAt} />}
      {item.comment && <p className="text-ink-2">&ldquo;{item.comment}&rdquo;</p>}
      {item.reviewedAt ? (
        <p className="text-[13px] text-ink-3">
          Reviewed {formatDate(item.reviewedAt)}
          {item.reviewedBy?.name && ` by ${item.reviewedBy.name}`}
          {item.reviewNote && `: ${item.reviewNote}`}
        </p>
      ) : (
        item.flagged && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-ink-3">
              Note (optional)
              <input
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you did about it"
                className="h-10 rounded-control border border-seam bg-plate px-3 text-sm text-ink"
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              loading={review.isPending && !review.variables?.resume}
              disabled={review.isPending}
              onClick={() => review.mutate({ resume: false })}
            >
              {paused ? 'Reviewed, keep paused' : 'Mark reviewed'}
            </Button>
            {paused && (
              <Button
                size="sm"
                loading={review.isPending && review.variables?.resume}
                disabled={review.isPending}
                onClick={() => review.mutate({ resume: true })}
              >
                Reviewed, resume rider
              </Button>
            )}
            {paused && (
              <p className="w-full text-[12px] text-ink-3">
                {item.rider.name} is paused while this report is open.
              </p>
            )}
          </div>
        )
      )}
    </li>
  );
}

// The rider's side of a report. Until they've written it, admins see that it's missing but can decide without it, so
// a rider can't hold a case open by staying quiet.
export function RiderSide({ reply, waiting, mine = false }) {
  if (reply) {
    return (
      <div className="rounded-control border border-seam bg-raised/60 px-3 py-2">
        <p className="text-[12px] text-ink-3">
          {mine ? 'Your side' : "Rider's side"} · {formatDate(reply.at)}
        </p>
        <p className="text-ink">{reply.text}</p>
      </div>
    );
  }
  if (!waiting) return null;
  return (
    <p className="text-[13px] text-ink-3">
      Waiting for the rider&apos;s side. You can still decide without it.
    </p>
  );
}
