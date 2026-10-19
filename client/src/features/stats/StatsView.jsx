import { Link } from 'react-router';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusPill } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ORDER_STATUSES } from '../../lib/constants.js';
import { formatMoney } from '../../lib/format.js';
import { useThemeColors } from '../../providers/ThemeProvider.jsx';

const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
const compactPeso = (cents) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-control border border-seam bg-raised px-3 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]">
      <p className="text-ink-3">{shortDate.format(new Date(`${d.date}T00:00:00`))}</p>
      <p className="font-mono text-ink tabular-nums">
        {formatMoney(d.salesCents)}{' '}
        <span className="font-sans text-ink-3">
          that day, {d.orders} order{d.orders === 1 ? '' : 's'}
        </span>
      </p>
      <p className="font-mono text-accent-ink tabular-nums">
        {formatMoney(d.total)} <span className="font-sans text-ink-3">so far</span>
      </p>
      <p className="font-mono text-ink-3 tabular-nums">
        {formatMoney(d.prevTotal)} <span className="font-sans">by this day last month</span>
      </p>
    </div>
  );
}

// Running totals: sales so far in the last 30 days, and over the 30 before them day for day. A running total only
// rises, so a smooth curve through it is accurate, and its slope is the pace (steep stretches are good days).
const runningTotals = (data) => {
  let total = 0;
  let prevTotal = 0;
  return data.map((d) => {
    total += d.salesCents;
    prevTotal += d.prevCents ?? 0;
    return { ...d, total, prevTotal };
  });
};

function SalesHeading() {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="font-medium">Sales so far, last 30 days</h2>
      <p className="flex items-center gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent-ink" aria-hidden="true" /> This month
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink-3" aria-hidden="true" /> Month before
        </span>
      </p>
    </div>
  );
}

function SalesChart({ data }) {
  const c = useThemeColors();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={runningTotals(data)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.accent} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.seam} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => shortDate.format(new Date(`${d}T00:00:00`))}
            tick={{ fill: c.ink3, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={6}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={compactPeso}
            tick={{ fill: c.ink3, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.edge, strokeDasharray: '3 3' }} />
          <Line
            type="monotone"
            dataKey="prevTotal"
            stroke={c.ink3}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={c.accentInk}
            strokeWidth={2}
            fill="url(#salesFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, fill: c.accentInk, stroke: c.bg, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsView({ query, figures = () => [], aside, statusLink, productLink }) {
  const { data, isPending, isError, error, refetch } = query;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  // Loading, laid out like what loads: the figures, the sales chart, and the two 40px-row lists side by side.
  if (isPending) {
    return (
      <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
        <section>
          <Skeleton className="mb-4 h-5 w-56" />
          <Skeleton className="h-64 w-full" />
        </section>
        <div className="grid gap-10 md:grid-cols-2">
          {[ORDER_STATUSES.length, 5].map((rows, col) => (
            <section key={col}>
              <Skeleton className="mb-4 h-5 w-40" />
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex h-10 items-center justify-between gap-4">
                  <Skeleton className={col ? 'h-4 w-1/2' : 'h-6 w-24 rounded-full'} />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    ['Sales, last 30 days', formatMoney(data.salesCents30d)],
    ['Orders, last 30 days', String(data.orders30d)],
    ...figures(data),
  ];

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {stats.map(([label, value, to]) => {
          const body = (
            <>
              <dt className="text-[13px] text-ink-3">{label}</dt>
              <dd className="font-mono text-2xl text-ink tabular-nums">{value}</dd>
            </>
          );
          return to ? (
            <Link
              key={label}
              to={to}
              className="group -m-2 flex flex-col gap-1 rounded-control p-2 hover:bg-raised"
            >
              {body}
            </Link>
          ) : (
            <div key={label} className="flex flex-col gap-1">
              {body}
            </div>
          );
        })}
      </dl>

      <section>
        <SalesHeading />
        <SalesChart data={data.salesByDay} />
      </section>

      {/* Both lists use the same 40px rows, so side by side their rows line up; numbers start at a common left edge. */}
      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-4 font-medium">Orders by status</h2>
          <ul className="flex flex-col">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                {statusLink ? (
                  <Link
                    to={statusLink(s)}
                    className="-mx-2 flex h-10 items-center justify-between rounded-control px-2 hover:bg-raised"
                  >
                    <StatusPill status={s} />
                    <span className="w-12 font-mono text-sm tabular-nums">{data.ordersByStatus[s]}</span>
                  </Link>
                ) : (
                  <div className="flex h-10 items-center justify-between">
                    <StatusPill status={s} />
                    <span className="w-12 font-mono text-sm tabular-nums">{data.ordersByStatus[s]}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-4 font-medium">Top products, last 30 days</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-ink-3">No sales in the last 30 days.</p>
          ) : (
            <ol className="flex flex-col text-sm">
              {data.topProducts.map((p) => (
                <li
                  key={p.productId}
                  className="grid h-10 grid-cols-[minmax(0,1fr)_4.5rem_6rem] items-center gap-4"
                >
                  {productLink ? (
                    <Link to={productLink(p)} className="truncate text-ink-2 hover:text-accent-ink">
                      {p.name}
                    </Link>
                  ) : (
                    <span className="truncate text-ink-2">{p.name}</span>
                  )}
                  <span className="font-mono text-ink-2 tabular-nums">{p.units} sold</span>
                  <span className="font-mono text-ink tabular-nums">{formatMoney(p.salesCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {aside?.(data)}
    </div>
  );
}
