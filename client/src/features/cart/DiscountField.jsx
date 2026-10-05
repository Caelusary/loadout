import { zodResolver } from '@hookform/resolvers/zod';
import { Tag as TagIcon, X } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { formatMoney } from '../../lib/format.js';

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a discount code')
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, 'Codes are 4 to 20 letters or numbers')),
});

// Applies a discount code at checkout. The server prices it from the cart (never from this form)
// and prices it again when the order is placed. Its own small form, validated like every other
// (React Hook Form + Zod), nested visually inside checkout but submitted separately.
export function DiscountField({ items, applied, error, onError, onApply }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { code: '' }, mode: 'onSubmit' });

  // Errors raised outside this form (a code that stopped working at checkout, or a changed cart) show here too.
  useEffect(() => {
    if (error) setError('code', { type: 'server', message: error });
    else clearErrors('code');
  }, [error, setError, clearErrors]);

  const apply = handleSubmit(async ({ code }) => {
    onError('');
    try {
      const res = await api('/coupons/preview', { method: 'POST', body: { code, items } });
      onApply({ code: res.code, discountCents: res.discountCents });
      reset();
    } catch (err) {
      onError(err.fields?.couponCode ?? err.message);
    }
  });

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-control border border-seam bg-bg px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <TagIcon size={16} className="text-ok" />
          <span className="font-mono">{applied.code}</span>
          <span className="text-ink-3">saves {formatMoney(applied.discountCents)}</span>
        </span>
        <button
          type="button"
          onClick={() => onApply(null)}
          aria-label="Remove discount code"
          className="grid size-8 place-items-center rounded-control text-ink-3 hover:bg-raised hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const message = errors.code?.message;
  const field = register('code', { onChange: () => error && onError('') });
  return (
    <div className="flex flex-col gap-1.5 border-t border-seam pt-4">
      <label htmlFor="discount-code" className="text-[13px] font-medium text-ink-2">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          {...field}
          onKeyDown={(e) => {
            // Enter applies the code instead of submitting the whole checkout form around it.
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="LOADOUT10"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? 'discount-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-control border border-edge bg-plate px-3 font-mono text-[14px] text-ink uppercase placeholder:text-ink-3/60 focus:border-accent-ink focus:outline-none focus:placeholder:text-transparent aria-invalid:border-bad"
        />
        <Button variant="secondary" onClick={apply} loading={isSubmitting}>
          Apply
        </Button>
      </div>
      {message && (
        <p id="discount-error" className="text-[13px] text-bad">
          {message}
        </p>
      )}
    </div>
  );
}
