import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { FormError } from '../../components/ui/feedback.jsx';
import { RadioCards, TextAreaField } from '../../components/ui/fields.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { AUTO_DELIVER_DAYS, RETURN_REASONS, RETURN_WINDOW_DAYS } from '../../lib/constants.js';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const REASONS = RETURN_REASONS;
const REASON_LABELS = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));
const WINDOW_DAYS = RETURN_WINDOW_DAYS;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS = {
  requested: { label: 'Waiting for the shop', tone: 'accent' },
  approved: { label: 'Approved: send it back', tone: 'accent' },
  declined: { label: 'Declined by the shop', tone: 'bad' },
  escalated: { label: 'With an admin', tone: 'accent' },
  refunded: { label: 'Refunded', tone: 'ok' },
  closed: { label: 'Closed by an admin', tone: 'bad' },
};
const PENDING = ['requested', 'escalated'];
const WHO = { customer: 'Customer', seller: 'Shop', admin: 'Admin' };

const lastAt = (history, status) => [...(history ?? [])].reverse().find((h) => h.status === status)?.at;

// Returns on one order: the customer asks within 7 days of delivery, the shop decides, a declined
// return can go to an admin, and the refund is recorded when the shop gets the item back.
export function ReturnsPanel({ order, isCustomer, isSellerOfOrder }) {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [noteFor, setNoteFor] = useState(null); // { ret, kind: 'decline' | 'escalate' | 'admin-approve' | 'admin-decline' }
  const [note, setNote] = useState('');
  // Read once per visit: windows are days long, so a stale "now" by a few minutes doesn't matter.
  const [now] = useState(() => Date.now());
  const key = ['order', order._id, 'returns'];
  const { data: returns = [], isSuccess: loaded } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api(`/orders/${order._id}/returns`, { signal }).then((r) => r.items),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['order', order._id] });
    queryClient.invalidateQueries({ queryKey: ['returns'] });
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['products'] }); // a refund puts stock back
  };
  const act = useMutation({
    mutationFn: ({ path, body, method = 'PATCH' }) => api(path, { method, body }),
    onSuccess: (_res, { done }) => {
      toast.show(done);
      setNoteFor(null);
      setNote('');
      refresh();
    },
    onError: (err) => toast.error(err.fields?.note ?? err.message),
  });

  // Same rules as the server: the fallback for orders without a delivered entry, and a seller's
  // delivered mark never starting the window before the automatic completion would have.
  const deliveredAt = lastAt(order.statusHistory, 'delivered') ?? (order.status === 'delivered' ? order.updatedAt : null);
  const shippedAt = lastAt(order.statusHistory, 'shipped');
  const startsAt =
    deliveredAt && order.deliveredBy === 'seller' && shippedAt
      ? Math.max(new Date(deliveredAt).getTime(), new Date(shippedAt).getTime() + AUTO_DELIVER_DAYS * DAY_MS)
      : deliveredAt && new Date(deliveredAt).getTime();
  const closesAt = startsAt && new Date(startsAt + WINDOW_DAYS * DAY_MS);
  const windowOpen = order.status === 'delivered' && closesAt && closesAt.getTime() > now;
  const waiting = returns.some((r) => PENDING.includes(r.status));
  const returned = new Map();
  // Every return uses up its items, including a closed one (an admin's close is final).
  for (const r of returns) {
    for (const i of r.items) returned.set(i.product, (returned.get(i.product) ?? 0) + i.qty);
  }
  const returnable = order.items.map((i) => ({ ...i, left: i.qty - (returned.get(i.product) ?? 0) })).filter((i) => i.left > 0);
  const canAsk = loaded && isCustomer && windowOpen && !waiting && returnable.length > 0;
  const busy = act.isPending;

  if (!returns.length && !(isCustomer && order.status === 'delivered')) return null;

  const dialog = {
    decline: { title: 'Decline this return?', label: 'Decline', field: 'Why? The customer sees this.', send: (r) => ({ path: `/returns/${r._id}/decision`, body: { decision: 'decline', note }, done: 'Return declined' }) },
    escalate: { title: 'Ask an admin to review?', label: 'Send to an admin', field: 'Why do you disagree with the shop?', send: (r) => ({ path: `/returns/${r._id}/escalate`, body: { note }, done: 'Sent to an admin' }) },
    'admin-approve': { title: 'Approve this return?', label: 'Approve', field: 'Your reason (both sides see it)', send: (r) => ({ path: `/admin/returns/${r._id}`, body: { decision: 'approve', note }, done: 'Return approved' }) },
    'admin-refund': { title: 'Record the refund?', label: 'Record refund', field: 'How do you know the item went back? (both sides see this)', send: (r) => ({ path: `/admin/returns/${r._id}`, body: { decision: 'refund', note }, done: 'Refund recorded and stock returned' }) },
    'admin-decline': { title: 'Close this return?', label: 'Close it', field: 'Your reason (both sides see it)', send: (r) => ({ path: `/admin/returns/${r._id}`, body: { decision: 'decline', note }, done: 'Return closed' }) },
  }[noteFor?.kind];

  return (
    <section aria-labelledby="returns-heading" className="mt-10 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="returns-heading" className="wide text-lg font-bold">
          Returns
        </h2>
        {isCustomer && order.status === 'delivered' && (
          <p className="text-[13px] text-ink-3">
            {windowOpen
              ? `Returns for damaged, wrong or not-as-described items are accepted until ${formatDate(closesAt)}. Shipping isn't refunded.`
              : 'The 7-day return window for this order has closed.'}
          </p>
        )}
      </div>

      {returns.map((r) => {
        const declinedAt = lastAt(r.history, 'declined');
        const canEscalate = isCustomer && r.status === 'declined' && now - new Date(declinedAt).getTime() < WINDOW_DAYS * DAY_MS;
        return (
          <article key={r._id} className="flex flex-col gap-3 rounded-panel border border-seam p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tag tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Tag>
              <span className="font-mono text-[13px] text-ink-2 tabular-nums">Refund {formatMoney(r.refundCents)}</span>
            </div>
            <p className="text-sm">
              {r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} · <span className="text-ink-2">{REASON_LABELS[r.reason]}</span>
            </p>
            <p className="text-sm text-ink-2">{r.details}</p>
            <ol className="flex flex-col gap-1 border-l border-seam pl-3 text-[13px]">
              {r.history.map((h, i) => (
                <li key={i} className="text-ink-3">
                  <span className="font-mono tabular-nums">{formatDateTime(h.at)}</span> · {WHO[h.by]}: {STATUS[h.status].label}
                  {h.note && <span className="block text-ink-2">&ldquo;{h.note}&rdquo;</span>}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              {isSellerOfOrder && r.status === 'requested' && (
                <>
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={() => act.mutate({ path: `/returns/${r._id}/decision`, body: { decision: 'approve' }, done: 'Return approved' })}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setNoteFor({ ret: r, kind: 'decline' })}>
                    Decline
                  </Button>
                </>
              )}
              {isSellerOfOrder && r.status === 'approved' && (
                <Button size="sm" loading={busy} onClick={() => act.mutate({ path: `/returns/${r._id}/received`, done: 'Refund recorded and stock returned' })}>
                  I got the items back
                </Button>
              )}
              {canEscalate && (
                <Button size="sm" variant="secondary" onClick={() => setNoteFor({ ret: r, kind: 'escalate' })}>
                  Ask an admin to review
                </Button>
              )}
              {/* The server says when an admin may act: escalated, or a shop that sat on it 3 days or can't act. */}
              {can('orders') && r.adminCanSettle && ['escalated', 'requested'].includes(r.status) && (
                <>
                  <Button size="sm" onClick={() => setNoteFor({ ret: r, kind: 'admin-approve' })}>
                    Approve return
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNoteFor({ ret: r, kind: 'admin-decline' })}>
                    Close without refund
                  </Button>
                </>
              )}
              {can('orders') && r.adminCanSettle && r.status === 'approved' && (
                <Button size="sm" variant="secondary" onClick={() => setNoteFor({ ret: r, kind: 'admin-refund' })}>
                  Record refund for the shop
                </Button>
              )}
            </div>
          </article>
        );
      })}

      {canAsk && !asking && (
        <div>
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Request a return
          </Button>
        </div>
      )}
      {asking && (
        <ReturnForm
          items={returnable}
          onCancel={() => setAsking(false)}
          onSent={() => {
            setAsking(false);
            refresh();
            toast.show('Return requested. The shop has been told.');
          }}
          orderId={order._id}
        />
      )}

      <ConfirmDialog
        open={Boolean(noteFor)}
        title={dialog?.title ?? ''}
        confirmLabel={dialog?.label}
        cancelLabel="Cancel"
        tone={['admin-approve', 'admin-refund', 'escalate'].includes(noteFor?.kind) ? 'primary' : 'danger'}
        pending={act.isPending}
        onConfirm={() => act.mutate(dialog.send(noteFor.ret))}
        onClose={() => {
          setNoteFor(null);
          setNote('');
        }}
      >
        <TextAreaField label={dialog?.field} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </ConfirmDialog>
    </section>
  );
}

// Mirrors the server's ReturnRequest rules: at least one unit, a listed reason, and 10 to 1000 characters.
const returnSchema = z
  .object({
    qty: z.record(z.coerce.number().int().min(0)),
    reason: z.enum(RETURN_REASONS.map((r) => r.value), { errorMap: () => ({ message: 'Choose a reason.' }) }),
    details: z
      .string()
      .trim()
      .min(10, 'Describe the problem in at least 10 characters.')
      .max(1000, 'Keep it under 1000 characters.'),
  })
  .refine((v) => Object.values(v.qty).some((n) => n > 0), { path: ['items'], message: 'Choose at least one item.' });

function ReturnForm({ items, orderId, onCancel, onSent }) {
  const [formError, setFormError] = useState('');
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(returnSchema),
    defaultValues: { qty: Object.fromEntries(items.map((i) => [i.product, 0])), reason: '', details: '' },
  });

  const submit = handleSubmit(async ({ qty, reason, details }) => {
    setFormError('');
    const chosen = items.filter((i) => qty[i.product] > 0).map((i) => ({ productId: i.product, qty: qty[i.product] }));
    try {
      await api(`/orders/${orderId}/returns`, { method: 'POST', body: { items: chosen, reason, details } });
      onSent();
    } catch (err) {
      if (!applyServerErrors(err, setError)) setFormError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-panel border border-seam p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">What are you returning?</legend>
        {items.map((i) => (
          <label key={i.product} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.name}</span>
            <select
              aria-label={`How many ${i.name} to return`}
              {...register(`qty.${i.product}`, { valueAsNumber: true })}
              className="h-10 rounded-control border border-edge bg-bg px-3 text-sm focus:border-accent-ink focus:outline-none"
            >
              {Array.from({ length: i.left + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : n}
                </option>
              ))}
            </select>
          </label>
        ))}
        {errors.items && <p className="text-[13px] text-bad">{errors.items.message}</p>}
      </fieldset>
      <Controller
        name="reason"
        control={control}
        render={({ field }) => (
          <RadioCards
            legend="Why?"
            name="return-reason"
            options={RETURN_REASONS}
            value={field.value}
            onChange={field.onChange}
            error={errors.reason?.message}
          />
        )}
      />
      <TextAreaField label="What's wrong with it?" rows={3} maxLength={1000} error={errors.details?.message} {...register('details')} />
      <FormError message={formError} />
      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting}>
          Send request
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
