import { Link } from 'react-router';
import { OrderStatus, Price } from '../../components/ui/chips.jsx';
import { EmptyState } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { ORDER_STATUSES, STATUS_LABELS } from '../../lib/constants.js';
import { formatDate, orderNumber } from '../../lib/format.js';
import { itemSummary } from './OrderRow.jsx';

export function StatusTabs({ value, onChange, counts }) {
  return (
    <div role="tablist" aria-label="Filter by status" className="mb-5 flex gap-1 overflow-x-auto">
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
    </div>
  );
}

// Seller and admin order lists. `showShop` adds the shop column for admins; `action` renders a per-row control.
export function OrdersTable({ orders, showShop = false, action }) {
  const columns = [
    { label: 'Order' },
    { label: 'Customer' },
    ...(showShop ? [{ label: 'Shop' }] : []),
    { label: 'Total', align: 'right' },
    { label: 'Status' },
    ...(action ? [{ label: '', align: 'right' }] : []),
  ];
  return (
    <Table columns={columns} empty={orders.length === 0 && <EmptyState title="No orders here">Orders with this status will show up here.</EmptyState>}>
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
          <Cell className="text-ink-2">{o.user?.name ?? 'Deleted account'}</Cell>
          {showShop && <Cell className="text-ink-2">{o.seller?.sellerProfile?.shopName ?? 'Deleted account'}</Cell>}
          <Cell align="right">
            <Price cents={o.totalCents} />
          </Cell>
          <Cell>
            <OrderStatus order={o} />
          </Cell>
          {action && <Cell align="right">{action(o)}</Cell>}
        </tr>
      ))}
    </Table>
  );
}
