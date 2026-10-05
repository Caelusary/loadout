import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatusPill } from '../../components/ui/chips.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { ORDER_STATUSES } from '../../lib/constants.js';
import { formatMoney } from '../../lib/format.js';
import { useThemeColors } from '../../providers/ThemeProvider.jsx';

const shortDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
const compactPeso = (cents) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(
    cents / 100,
  );

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-control border border-seam bg-raised px-3 py-2 text-[13px] shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)]">
      <p className="text-ink-3">{shortDate.format(new Date(`${d.date}T00:00:00`))}</p>
      <p className="font-mono text-ink tabular-nums">{formatMoney(d.salesCents)}</p>
      <p className="text-ink-3">
        {d.orders} order{d.orders === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function SalesChart({ data }) {
  const c = useThemeColors();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <Area
            type="monotone"
            dataKey="salesCents"
            stroke={c.accentInk}
            strokeWidth={2}
            fill="url(#salesFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, fill: c.accentInk, stroke: c.bg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsView({ query, figures = () => [], aside }) {
  const { data, isPending, isError, error, refetch } = query;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
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
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-[13px] text-ink-3">{label}</dt>
            <dd className="font-mono text-2xl text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-4 font-medium">Daily sales</h2>
        <SalesChart data={data.salesByDay} />
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-4 font-medium">Orders by status</h2>
          <ul className="flex flex-col gap-2.5">
            {ORDER_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between">
                <StatusPill status={s} />
                <span className="font-mono text-sm tabular-nums">{data.ordersByStatus[s]}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-4 font-medium">Top products, last 30 days</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-ink-3">No sales in the last 30 days.</p>
          ) : (
            <ol className="flex flex-col gap-2.5 text-sm">
              {data.topProducts.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between gap-4">
                  <span className="truncate text-ink-2">{p.name}</span>
                  <span className="shrink-0 font-mono text-ink tabular-nums">
                    {p.units} sold, {formatMoney(p.salesCents)}
                  </span>
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
