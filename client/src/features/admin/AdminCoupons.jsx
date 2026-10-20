import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { SelectField, TextField } from '../../components/ui/fields.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { formatDate, formatMoney, parsePesos } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const KEY = ['admin', 'coupons'];

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4,20}$/, 'Use 4 to 20 letters or numbers'),
    type: z.enum(['percent', 'fixed'], { errorMap: () => ({ message: 'Choose a discount type' }) }),
    value: z.string().trim().min(1, 'Enter an amount'),
    minSubtotal: z.string().trim(),
    maxUses: z.string().trim().regex(/^\d*$/, 'Whole numbers only'),
    expiresAt: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.value);
    if (v.type === 'percent' && !(Number.isInteger(n) && n >= 1 && n <= 90))
      ctx.addIssue({ path: ['value'], code: 'custom', message: 'Enter a whole percent from 1 to 90' });
    if (v.type === 'fixed' && !(parsePesos(v.value) > 0))
      ctx.addIssue({ path: ['value'], code: 'custom', message: 'Enter a peso amount' });
    if (v.minSubtotal && Number.isNaN(parsePesos(v.minSubtotal)))
      ctx.addIssue({ path: ['minSubtotal'], code: 'custom', message: 'Enter a peso amount' });
  });

const describe = (c) => (c.type === 'percent' ? `${c.value}% off` : `${formatMoney(c.value)} off`);

// Expiry comes first: an expired code can't be used whether it's on or off, so "Off" would hide why.
function status(c) {
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return ['Expired', 'bad'];
  if (!c.isActive) return ['Off', 'neutral'];
  if (c.maxUses && c.usedCount >= c.maxUses) return ['Used up', 'bad'];
  return ['Active', 'ok'];
}

// The form's fields for an existing code, so editing starts from what it is now.
const pesos = (cents) => (cents ? String(cents / 100) : '');
const manilaDay = (iso) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso)) : '';
const valuesOf = (c) => ({
  code: c.code,
  type: c.type,
  value: c.type === 'percent' ? String(c.value) : pesos(c.value),
  minSubtotal: pesos(c.minSubtotalCents),
  maxUses: c.maxUses ? String(c.maxUses) : '',
  expiresAt: manilaDay(c.expiresAt),
});
const EMPTY = { code: '', type: 'percent', value: '', minSubtotal: '', maxUses: '', expiresAt: '' };

// Creates a code, or edits one (`editing`). The code and its type stay fixed once made, as customers may have used
// it; the amount, minimum, uses and expiry can change, so an expired or used-up code can be extended.
function CouponForm({ editing, onDone }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: editing ? valuesOf(editing) : EMPTY,
  });
  const type = useWatch({ control, name: 'type' });

  const onSubmit = handleSubmit(async (v) => {
    // Disabled fields aren't submitted, so an edit takes the type from the code being edited.
    const kind = editing?.type ?? v.type;
    const terms = {
      value: kind === 'percent' ? Number(v.value) : parsePesos(v.value),
      minSubtotalCents: v.minSubtotal ? parsePesos(v.minSubtotal) : 0,
      ...(v.maxUses && { maxUses: Number(v.maxUses) }),
      // End of the chosen day, Manila time.
      ...(v.expiresAt && { expiresAt: new Date(`${v.expiresAt}T23:59:59+08:00`).toISOString() }),
    };
    try {
      if (editing) {
        // Blank fields on an edit mean "no limit" / "never", so they're sent as cleared, not left out.
        await api(`/admin/coupons/${editing._id}`, {
          method: 'PATCH',
          body: { maxUses: null, expiresAt: null, ...terms },
        });
        toast.show(`${editing.code} updated`);
        onDone();
      } else {
        await api('/admin/coupons', { method: 'POST', body: { code: v.code, type: v.type, ...terms } });
        toast.show(`${v.code} created`);
        reset(EMPTY);
      }
      queryClient.invalidateQueries({ queryKey: KEY });
    } catch (err) {
      if (!applyServerErrors(err, setError, { minSubtotalCents: 'minSubtotal' })) toast.error(err.message);
    }
  });

  return (
    <form
      id="coupon-form"
      onSubmit={onSubmit}
      noValidate
      className={`grid scroll-mt-24 gap-4 rounded-panel border bg-plate p-5 sm:grid-cols-2 lg:grid-cols-3 ${editing ? 'border-accent-ink/50' : 'border-seam'}`}
    >
      <h2 className="wide text-lg font-bold sm:col-span-2 lg:col-span-3">
        {editing ? `Edit ${editing.code}` : 'New code'}
      </h2>
      <TextField
        label="Code"
        placeholder="SUMMER15"
        disabled={Boolean(editing)}
        hint={editing ? 'A code keeps its name once made' : undefined}
        error={errors.code?.message}
        {...register('code')}
      />
      <SelectField
        disabled={Boolean(editing)}
        label="Type"
        options={[
          { value: 'percent', label: 'Percent off' },
          { value: 'fixed', label: 'Pesos off' },
        ]}
        error={errors.type?.message}
        {...register('type')}
      />
      <TextField
        label={type === 'percent' ? 'Percent' : 'Amount (₱)'}
        inputMode="decimal"
        placeholder={type === 'percent' ? '15' : '200'}
        error={errors.value?.message}
        {...register('value')}
      />
      <TextField
        label="Minimum subtotal (₱)"
        optional
        inputMode="decimal"
        placeholder="3000"
        error={errors.minSubtotal?.message}
        {...register('minSubtotal')}
      />
      <TextField
        label="Total uses"
        optional
        inputMode="numeric"
        hint="Leave blank for unlimited"
        error={errors.maxUses?.message}
        {...register('maxUses')}
      />
      <TextField
        label="Expires"
        optional
        type="date"
        error={errors.expiresAt?.message}
        {...register('expiresAt')}
      />
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" loading={isSubmitting}>
          {editing ? 'Save changes' : 'Create code'}
        </Button>
        {editing && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

// The table's columns, shared with its loading placeholder so the two always match.
const COUPON_COLUMNS = [
  { label: 'Code', skeleton: 'line' },
  { label: 'Discount', skeleton: 'short' },
  { label: 'Minimum', skeleton: 'short' },
  { label: 'Used', skeleton: 'short' },
  { label: 'Expires', skeleton: 'short' },
  { label: 'Status', skeleton: 'tag' },
  { label: '', skeleton: 'button', align: 'right' },
];

export default function AdminCoupons() {
  useTitle('Discount codes');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const edit = (c) => {
    setEditing(c);
    requestAnimationFrame(() =>
      document.getElementById('coupon-form')?.scrollIntoView({ behavior: 'smooth' }),
    );
  };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => api('/admin/coupons', { signal }).then((r) => r.items),
  });
  const toggle = useMutation({
    mutationFn: (c) => api(`/admin/coupons/${c._id}`, { method: 'PATCH', body: { isActive: !c.isActive } }),
    onSuccess: (res) => {
      toast.show(res.coupon.isActive ? `${res.coupon.code} is on` : `${res.coupon.code} is off`);
      queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-8">
      <PanelHeader
        title="Discount codes"
        description="Customers enter these at checkout. Each customer can use a code once."
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={COUPON_COLUMNS} />
      ) : (
        <Table
          columns={COUPON_COLUMNS}
          empty={!data.length && <EmptyState title="No codes yet">Create one below.</EmptyState>}
        >
          {data.map((c) => {
            const [label, tone] = status(c);
            return (
              <tr key={c._id}>
                <Cell className="font-mono font-medium">{c.code}</Cell>
                <Cell>{describe(c)}</Cell>
                <Cell className="font-mono tabular-nums">
                  {c.minSubtotalCents ? formatMoney(c.minSubtotalCents) : 'None'}
                </Cell>
                <Cell className="font-mono tabular-nums">
                  {c.usedCount}
                  {c.maxUses ? ` / ${c.maxUses}` : ''}
                </Cell>
                <Cell>{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</Cell>
                <Cell>
                  <Tag tone={tone}>{label}</Tag>
                </Cell>
                <Cell align="right">
                  {/* Edit sits last so it lines up down the column, with or without the on/off button. */}
                  <span className="inline-flex gap-1">
                    {/* An expired code can't be used either way, so turning it off or on would do nothing; Edit is how
                        it's extended. */}
                    {label !== 'Expired' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle.mutate(c)}
                        loading={toggle.isPending && toggle.variables?._id === c._id}
                      >
                        {c.isActive ? 'Turn off' : 'Turn on'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => edit(c)}>
                      Edit
                    </Button>
                  </span>
                </Cell>
              </tr>
            );
          })}
        </Table>
      )}
      <CouponForm key={editing?._id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
    </div>
  );
}
