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
  const review = useMutation({
    mutationFn: () => api(`/admin/rider-feedback/${item._id}`, { method: 'PATCH', body: { note } }),
    onSuccess: () => {
      toast.show('Marked as reviewed');
      queryClient.invalidateQueries({ queryKey: ['admin'] }); // the list, the queue and the menu count
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
            <Link to={`/admin/riders/${item.rider._id}`} className="font-medium hover:text-accent-ink">
              {item.rider.name}
            </Link>
          ) : (
            <span className="font-medium text-ink-3">Deleted rider</span>
          ))}
        {item.stars && <Stars value={item.stars} />}
        {item.report && <Tag tone="bad">Report: {RIDER_REPORT_LABELS[item.report.reason]}</Tag>}
        <span className="text-[13px] text-ink-3">
          {item.user?.name ?? 'A buyer'} ·{' '}
          <Link to={`/orders/${item.order}`} className="font-mono hover:text-accent-ink">
            {orderNumber(item.order)}
          </Link>{' '}
          · {formatDate(item.createdAt)}
        </span>
      </div>
      {item.report && <p className="text-ink">&ldquo;{item.report.note}&rdquo;</p>}
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
            <Button size="sm" variant="secondary" loading={review.isPending} onClick={() => review.mutate()}>
              Mark reviewed
            </Button>
          </div>
        )
      )}
    </li>
  );
}
