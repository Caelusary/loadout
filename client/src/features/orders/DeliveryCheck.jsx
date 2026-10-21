import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { TextAreaField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { RateItem } from '../reviews/RateItem.jsx';
import { RiderSide } from '../admin/riderParts.jsx';
import { ReplyToReport } from '../rider/ReplyToReport.jsx';
import { RateRider } from './RiderCard.jsx';

// "Did it arrive?" The rider marks an order delivered, but only the buyer knows. These are the two answers, used on
// the order page and in the prompt that follows a delivery. Answering is never required: after 7 days an
// unanswered order simply counts as received.
export function ReceiptActions({ order, onDone }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order', order._id] });
  };

  const confirm = useMutation({
    mutationFn: () => api(`/orders/${order._id}/received`, { method: 'PATCH' }),
    onSuccess: () => {
      refresh();
      onDone?.('received');
    },
    onError: (err) => toast.error(err.message),
  });
  const report = useMutation({
    mutationFn: () => api(`/orders/${order._id}/delivery-issue`, { method: 'POST', body: { note } }),
    onSuccess: () => {
      toast.show("Thanks. We've told the shop and an admin, and they'll look into it.");
      refresh();
      onDone?.('reported');
    },
    onError: (err) => toast.error(err.message),
  });

  if (reporting) {
    return (
      <div className="flex w-[min(26rem,calc(100vw-5rem))] flex-col gap-3">
        <TextAreaField
          label="What happened?"
          optional
          rows={3}
          maxLength={300}
          placeholder="For example: nobody came, or the rider said it was left with someone"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => report.mutate()} loading={report.isPending}>
            Report not received
          </Button>
          <Button variant="ghost" onClick={() => setReporting(false)} disabled={report.isPending}>
            Back
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button className="flex-1 sm:flex-none" onClick={() => confirm.mutate()} loading={confirm.isPending}>
        Yes, I got it
      </Button>
      <Button
        className="flex-1 sm:flex-none"
        variant="secondary"
        onClick={() => setReporting(true)}
        disabled={confirm.isPending}
      >
        Not received
      </Button>
    </div>
  );
}

// Admins with the Orders area settle a report with a note that the buyer, shop and rider all read.
function SettleReport({ order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState(null); // 'resolve' | 'dismiss'
  const [note, setNote] = useState('');
  const close = () => {
    setDecision(null);
    setNote('');
  };
  const settle = useMutation({
    mutationFn: () =>
      api(`/admin/orders/${order._id}/delivery-issue`, { method: 'PATCH', body: { decision, note } }),
    onSuccess: () => {
      toast.show(decision === 'resolve' ? 'Report resolved' : 'Report dismissed');
      queryClient.invalidateQueries({ queryKey: ['order', order._id] });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      close();
    },
    onError: (err) => toast.error(err.fields?.note ?? err.message),
  });
  const tooShort = note.trim().length < 3;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setDecision('resolve')}>
          Resolve…
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDecision('dismiss')}>
          Dismiss…
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(decision)}
        title={decision === 'resolve' ? 'Resolve this report?' : 'Dismiss this report?'}
        confirmLabel={decision === 'resolve' ? 'Resolve' : 'Dismiss'}
        cancelLabel="Back"
        tone="primary"
        pending={settle.isPending}
        onConfirm={() => (tooShort ? toast.error('Add a short note first.') : settle.mutate())}
        onClose={close}
      >
        <p>
          {decision === 'resolve'
            ? "The buyer was right and it has been dealt with (re-sent, refunded outside the app, and so on). It counts against the rider's record."
            : "The report isn't upheld, for example the courier log shows it was handed over. It doesn't count against the rider."}{' '}
          The buyer, the shop and the rider all see your note.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="Note"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

const box = 'mb-8 flex flex-col gap-3 rounded-panel border p-4 text-sm';

// The order page's strip about delivery: the question for the buyer, then what became of their answer or report.
export function DeliveryCheck({ order, isCustomer, isRider, canSettle }) {
  if (order.status !== 'delivered') return null;
  const issue = order.deliveryIssue;

  if (isCustomer) {
    if (order.awaitingReceipt) {
      return (
        <section className={`${box} border-accent-ink/50 bg-accent/5`} aria-label="Did it arrive?">
          <div>
            <h2 className="font-medium text-ink">Did your order arrive?</h2>
            <p className="text-ink-2">
              The rider marked it delivered. Let us know it reached you, or tell us if it didn&apos;t.
            </p>
          </div>
          <ReceiptActions order={order} />
        </section>
      );
    }
    if (issue?.status === 'open') return <ReportStatus issue={issue} who="You" />;
    return (
      <>
        {issue && <ReportStatus issue={issue} who="You" />}
        <FollowUp order={order} />
      </>
    );
  }
  if (!issue) return null;
  return (
    <ReportStatus issue={issue} who="The buyer">
      {(canSettle || isRider) && (
        <RiderSide reply={issue.riderReply} waiting={canSettle && issue.status === 'open'} mine={isRider} />
      )}
      {isRider && issue.status === 'open' && !issue.riderReply && <RiderReplyBox order={order} />}
      {canSettle && issue.status === 'open' && <SettleReport order={order} />}
    </ReportStatus>
  );
}

// After it arrived: everything left to do about this order in one place, at the top where the "Did it arrive?" question
// was. Rating the rider and reviewing each item, until both are done. Arriving with ?review=1 (from the delivery
// prompt) with one item left opens its form straight away.
function FollowUp({ order }) {
  const [params, setParams] = useSearchParams();
  const canRate = order.riderFeedback?.canRate;
  const toReview = order.items.filter((i) => !order.reviewedProducts?.includes(i.product));
  const autoOpen = params.get('review') === '1' && toReview.length === 1 ? toReview[0].product : null;
  const opened = () =>
    setParams(
      (p) => {
        p.delete('review');
        return p;
      },
      { replace: true },
    );
  const confirmed = order.receivedAt && (
    <p className="text-ink-3">You confirmed this arrived on {formatDate(order.receivedAt)}.</p>
  );
  if (!canRate && !toReview.length) return confirmed ? <div className="mb-8 text-sm">{confirmed}</div> : null;

  return (
    <section className={`${box} border-accent-ink/50 bg-accent/5`} aria-labelledby="follow-up-heading">
      <div>
        <h2 id="follow-up-heading" className="font-medium text-ink">
          How did it go?
        </h2>
        {confirmed}
      </div>
      {canRate && (
        <div className="flex flex-col gap-1 border-t border-seam pt-3">
          <p className="font-medium text-ink">Rate {order.rider.name}, your rider</p>
          <RateRider order={order} />
        </div>
      )}
      {toReview.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-seam pt-3">
          <p className="font-medium text-ink">Review {toReview.length === 1 ? 'your item' : 'your items'}</p>
          <ul className="flex flex-col gap-2">
            {toReview.map((item) => (
              <li key={item.product} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-ink-2">{item.name}</span>
                <RateItem order={order} item={item} autoOpen={autoOpen === item.product} onAutoOpen={opened} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// The rider tells their side of a "not received" report, next to their proof photo on the same page.
function RiderReplyBox({ order }) {
  const queryClient = useQueryClient();
  return (
    <div className="flex flex-col gap-1 border-t border-seam pt-3">
      <p className="text-ink-2">
        Tell us what happened on this delivery, like where you left it or who took it. An admin reads both sides.
      </p>
      <ReplyToReport
        path={`/orders/${order._id}/delivery-issue/reply`}
        onSent={() => queryClient.invalidateQueries({ queryKey: ['order', order._id] })}
      />
    </div>
  );
}

function ReportStatus({ issue, who, children }) {
  const open = issue.status === 'open';
  const tone = open
    ? 'border-warn/50 bg-warn/5'
    : issue.status === 'resolved'
      ? 'border-ok/50 bg-ok/5'
      : 'border-seam';
  return (
    <section className={`${box} ${tone}`} aria-label="Delivery report">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-ink">
          {open
            ? 'Reported as not received'
            : issue.status === 'resolved'
              ? 'Delivery report resolved'
              : 'Delivery report dismissed'}
        </h2>
        <p className="text-ink-2">
          {who} reported on {formatDate(issue.reportedAt)} that this order didn&apos;t arrive.
          {open && ' An admin is looking into it.'}
        </p>
        {issue.note && <p className="text-ink-2">&ldquo;{issue.note}&rdquo;</p>}
        {issue.resolution && (
          <p className="text-ink">
            <span className="text-ink-3">Admin note: </span>
            {issue.resolution}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
