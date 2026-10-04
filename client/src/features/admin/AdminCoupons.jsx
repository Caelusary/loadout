import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { SelectField, TextField } from '../../components/ui/fields.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, applyServerErrors } from '../../lib/api.js';
import { formatDate, formatMoney, parsePesos } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const KEY = ['admin', 'coupons'];

const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, 'Use 4 to 20 letters or numbers'),
    type: z.enum(['percent', 'fixed'], { errorMap: () => ({ message: 'Choose a discount type' }) }),
    value: z.string().trim().min(1, 'Enter an amount'),
    minSubtotal: z.string().trim(),
    maxUses: z.string().trim().regex(/^\d*$/, 'Whole numbers only'),
    expiresAt: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.value);
    if (v.type === 'percent' && !(Number.isInteger(n) && n >= 1 && n <= 90)) ctx.addIssue({ path: ['value'], code: 'custom', message: 'Enter a whole percent from 1 to 90' });
    if (v.type === 'fixed' && !(parsePesos(v.value) > 0)) ctx.addIssue({ path: ['value'], code: 'custom', message: 'Enter a peso amount' });
    if (v.minSubtotal && Number.isNaN(parsePesos(v.minSubtotal))) ctx.addIssue({ path: ['minSubtotal'], code: 'custom', message: 'Enter a peso amount' });
  });

const describe = (c) => (c.type === 'percent' ? `${c.value}% off` : `${formatMoney(c.value)} off`);

function status(c) {
  if (!c.isActive) return ['Off', 'neutral'];
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return ['Expired', 'bad'];
  if (c.maxUses && c.usedCount >= c.maxUses) return ['Used up', 'bad'];
  return ['Active', 'ok'];
}

function CreateCoupon() {
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
    defaultValues: { code: '', type: 'percent', value: '', minSubtotal: '', maxUses: '', expiresAt: '' },
  });
  const type = useWatch({ control, name: 'type' });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await api('/admin/coupons', {
        method: 'POST',
        body: {
          code: v.code,
          type: v.type,
          value: v.type === 'percent' ? Number(v.value) : parsePesos(v.value),
          minSubtotalCents: v.minSubtotal ? parsePesos(v.minSubtotal) : 0,
          ...(v.maxUses && { maxUses: Number(v.maxUses) }),
          // End of the chosen day, Manila time.
          ...(v.expiresAt && { expiresAt: new Date(`${v.expiresAt}T23:59:59+08:00`).toISOString() }),
        },
      });
      toast.show(`${v.code} created`);
      reset();
      queryClient.invalidateQueries({ queryKey: KEY });
    } catch (err) {
      if (!applyServerErrors(err, setError, { minSubtotalCents: 'minSubtotal' })) toast.error(err.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-panel border border-seam bg-plate p-5 sm:grid-cols-2 lg:grid-cols-3">
      <h2 className="wide text-lg font-bold sm:col-span-2 lg:col-span-3">New code</h2>
      <TextField label="Code" placeholder="SUMMER15" error={errors.code?.message} {...register('code')} />
      <SelectField
        label="Type"
        options={[
          { value: 'percent', label: 'Percent off' },
          { value: 'fixed', label: 'Pesos off' },
        ]}
        error={errors.type?.message}
        {...register('type')}
      />
      <TextField label={type === 'percent' ? 'Percent' : 'Amount (₱)'} inputMode="decimal" placeholder={type === 'percent' ? '15' : '200'} error={errors.value?.message} {...register('value')} />
      <TextField label="Minimum subtotal (₱)" optional inputMode="decimal" placeholder="3000" error={errors.minSubtotal?.message} {...register('minSubtotal')} />
      <TextField label="Total uses" optional inputMode="numeric" hint="Leave blank for unlimited" error={errors.maxUses?.message} {...register('maxUses')} />
      <TextField label="Expires" optional type="date" error={errors.expiresAt?.message} {...register('expiresAt')} />
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" loading={isSubmitting}>
          Create code
        </Button>
      </div>
    </form>
  );
}

export default function AdminCoupons() {
  useTitle('Discount codes');
  const toast = useToast();
  const queryClient = useQueryClient();
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
      <PanelHeader title="Discount codes" description="Customers enter these at checkout. Each customer can use a code once." />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <Table
          columns={[{ label: 'Code' }, { label: 'Discount' }, { label: 'Minimum' }, { label: 'Used' }, { label: 'Expires' }, { label: 'Status' }, { label: '', align: 'right' }]}
          empty={!data.length && <EmptyState title="No codes yet">Create one below.</EmptyState>}
        >
          {data.map((c) => {
            const [label, tone] = status(c);
            return (
              <tr key={c._id}>
                <Cell className="font-mono font-medium">{c.code}</Cell>
                <Cell>{describe(c)}</Cell>
                <Cell className="font-mono tabular-nums">{c.minSubtotalCents ? formatMoney(c.minSubtotalCents) : 'None'}</Cell>
                <Cell className="font-mono tabular-nums">
                  {c.usedCount}
                  {c.maxUses ? ` / ${c.maxUses}` : ''}
                </Cell>
                <Cell>{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</Cell>
                <Cell>
                  <Tag tone={tone}>{label}</Tag>
                </Cell>
                <Cell align="right">
                  <Button variant="ghost" size="sm" onClick={() => toggle.mutate(c)} loading={toggle.isPending && toggle.variables?._id === c._id}>
                    {c.isActive ? 'Turn off' : 'Turn on'}
                  </Button>
                </Cell>
              </tr>
            );
          })}
        </Table>
      )}
      <CreateCoupon />
    </div>
  );
}
