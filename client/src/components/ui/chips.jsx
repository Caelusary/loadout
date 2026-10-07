import { STATUS_LABELS, SWITCH_LABELS } from '../../lib/constants.js';
import { formatMoney, refundLevel } from '../../lib/format.js';

const SWITCH_COLORS = {
  linear: 'bg-linear',
  tactile: 'bg-tactile',
  clicky: 'bg-clicky',
  magnetic: 'bg-magnetic',
};

// The swatch uses the colours enthusiasts already associate with each switch type; the label carries the meaning.
export function SwitchChip({ type }) {
  if (!type) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
      <span className={`size-2 rounded-[2px] ${SWITCH_COLORS[type]}`} aria-hidden="true" />
      {SWITCH_LABELS[type]}
    </span>
  );
}

const STATUS_STYLES = {
  placed: 'border-edge text-ink-2',
  processing: 'border-warn/50 text-warn',
  shipped: 'border-info/50 text-info',
  'out-for-delivery': 'border-accent-ink/50 text-accent-ink',
  delivered: 'border-ok/50 text-ok',
  cancelled: 'border-bad/50 text-bad',
};

export function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// An order's status as people read it: a fully refunded order shows "Refunded" in place of "Delivered",
// and a partly refunded one keeps its status with a second pill beside it.
export function OrderStatus({ order }) {
  const refund = refundLevel(order);
  if (refund === 'full') {
    return (
      <span className="inline-flex h-6 items-center rounded-full border border-accent-ink/50 px-2.5 text-[12px] font-medium text-accent-ink">
        Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusPill status={order.status} />
      {refund === 'partial' && (
        <span className="inline-flex h-6 items-center rounded-full border border-accent-ink/50 px-2.5 text-[12px] font-medium text-accent-ink">
          Partly refunded
        </span>
      )}
    </span>
  );
}

export function Tag({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-edge text-ink-2',
    accent: 'border-accent-ink/50 text-accent-ink',
    bad: 'border-bad/50 text-bad',
    ok: 'border-ok/50 text-ok',
  };
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// `was` is a product's regular price while it's on sale (compareAtCents): the sale price shows first,
// then the regular price struck through and a Sale tag with the saving, as shops like Shopee do.
export function Price({ cents, was, className = '', tag = true }) {
  const onSale = was > cents;
  if (!onSale) return <span className={`font-mono tabular-nums ${className}`}>{formatMoney(cents)}</span>;
  const off = Math.round(((was - cents) / was) * 100);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`font-mono tabular-nums ${className}`}>{formatMoney(cents)}</span>
      <s className="font-mono text-[0.8em] text-ink-3 tabular-nums" aria-label={`was ${formatMoney(was)}`}>
        {formatMoney(was)}
      </s>
      {tag && (
        <span className="self-center rounded-full bg-bad px-2 py-0.5 text-[11px] leading-none font-semibold text-bg">
          Sale −{off}%
        </span>
      )}
    </span>
  );
}
