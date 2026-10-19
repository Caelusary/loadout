import { Link } from 'react-router';
import { OrderStatus, Price, Tag } from '../../components/ui/chips.jsx';
import { EmptyState } from '../../components/ui/feedback.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { ORDER_STATUSES, STATUS_LABELS } from '../../lib/constants.js';
import { formatDate, orderNumber } from '../../lib/format.js';
import { itemSummary } from './OrderRow.jsx';
import { ScrollRow } from '../../components/ui/ScrollRow.jsx';

export function StatusTabs({ value, onChange, counts }) {
  return (
    <ScrollRow role="tablist" aria-label="Filter by status" className="mb-5 flex gap-1">
      {['', ...ORDER_STATUSES].map((s) => (
        <button
          key={s || 'all'}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className="h-9 shrink-0 rounded-control px-3 text-[13px] text-ink-2 transition-colors hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
        >
          {s ? STATUS_LABELS[s] : 'All'}
          {counts?.[s] !== undefined && <span className="ml-1.5 font-mono text-ink-3">{counts[s]}</span>}
        </button>
      ))}
    </ScrollRow>
  );
}

// Seller and admin order lists. `showShop` adds the shop column for admins; `action` renders a per-row control.
// `loading` draws the same columns with placeholders while the orders load.
export function OrdersTable({ orders, showShop = false, action, loading = false }) {
  const columns = [
    { label: 'Order', skeleton: 'two' },
    { label: 'Status', skeleton: 'tag' },
    { label: 'Customer', skeleton: 'two' },
    ...(showShop ? [{ label: 'Shop' }] : []),
    { label: 'Total', skeleton: 'short' },
    ...(action ? [{ label: '', align: 'right', skeleton: 'button' }] : []),
  ];
  if (loading) return <TableSkeleton columns={columns} />;
  return (
    <Table
      columns={columns}
      empty={
        orders.length === 0 && (
          <EmptyState title="No orders here">Orders with this status will show up here.</EmptyState>
        )
      }
    >
      {orders.map((o) => (
        <tr key={o._id}>
          <Cell>
            <Link to={`/orders/${o._id}`} className="flex flex-col hover:text-accent-ink">
              <span className="font-mono font-medium">{orderNumber(o._id)}</span>
              <span className="max-w-64 truncate text-[12px] text-ink-3">
                {itemSummary(o)}, {formatDate(o.createdAt)}
              </span>
            </Link>
          </Cell>
          {/* Status sits next to the order number: it's what people scan the list for. */}
          <Cell>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <OrderStatus order={o} />
              {o.deliveryIssue?.status === 'open' && <Tag tone="bad">Not received</Tag>}
            </span>
          </Cell>
          <Cell className="text-ink-2">{o.user?.name ?? 'Deleted account'}</Cell>
          {showShop && (
            <Cell className="text-ink-2">{o.seller?.sellerProfile?.shopName ?? 'Deleted account'}</Cell>
          )}
          <Cell>
            <Price cents={o.totalCents} />
          </Cell>
          {action && <Cell align="right">{action(o)}</Cell>}
        </tr>
      ))}
    </Table>
  );
}
