import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDate, formatMoney, orderNumber } from '../../lib/format.js';
import { ScrollRow } from '../../components/ui/ScrollRow.jsx';

const LABELS = {
  stuck: 'Stuck with the shop',
  requested: 'New',
  approved: 'Approved',
  declined: 'Declined',
  escalated: 'With an admin',
  refunded: 'Refunded',
  closed: 'Closed',
};

// A list of returns for the Seller Center or the admin panel. Each one opens on its order, where the
// history and the approve / decline / received actions are.
// `actionable` is the statuses this viewer can act on (a shop answers requests and confirms receipt; an admin also
// settles escalations), so "Review" is only promised where there's something to do.
export function ReturnsList({
  title,
  description,
  endpoint,
  statuses,
  showShop,
  actionable = ['requested', 'approved', 'escalated'],
}) {
  useTitle(title);
  const [chosen, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [first, setFirst] = useState(null); // the opening tab, settled once the counts arrive
  const status = chosen ?? first ?? statuses[0];
  const params = { status, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['returns', endpoint, params],
    queryFn: ({ signal }) => api(`${endpoint}${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
  // Open on the first tab with something in it (the counts cover every tab), so the page doesn't land on an empty
  // list while returns wait elsewhere.
  if (first === null && data?.counts) setFirst(statuses.find((s) => data.counts[s] > 0) ?? statuses[0]);

  // Shared with the loading placeholder, so it draws the same columns.
  const columns = [
    { label: 'Order', skeleton: 'two' },
    { label: 'Customer', skeleton: 'two' },
    ...(showShop ? [{ label: 'Shop' }] : []),
    { label: 'Asked', skeleton: 'short' },
    { label: 'Refund', skeleton: 'short' },
    { label: '', align: 'right', skeleton: 'button' },
  ];
  return (
    <>
      <PanelHeader title={title} description={description} />
      <ScrollRow role="tablist" aria-label="Filter by status" className="mb-5 flex gap-1">
        {statuses.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`h-9 shrink-0 rounded-control px-3 text-sm whitespace-nowrap transition-colors ${status === s ? 'bg-raised text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {LABELS[s]}
            {data?.counts?.[s] !== undefined && (
              <span className="ml-1.5 font-mono text-ink-3">{data.counts[s]}</span>
            )}
          </button>
        ))}
      </ScrollRow>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={columns} />
      ) : (
        <>
          <Table
            columns={columns}
            empty={
              data.items.length === 0 && (
                <EmptyState title="No returns here">Returns with this status show up here.</EmptyState>
              )
            }
          >
            {data.items.map((r) => (
              <tr key={r._id}>
                <Cell className="font-mono">{orderNumber(r.order)}</Cell>
                <Cell>{r.user?.name ?? 'Deleted account'}</Cell>
                {showShop && (
                  <Cell className="text-ink-2">{r.seller?.sellerProfile?.shopName ?? 'Deleted shop'}</Cell>
                )}
                <Cell className="text-ink-2">{formatDate(r.createdAt)}</Cell>
                <Cell className="font-mono tabular-nums">{formatMoney(r.refundCents)}</Cell>
                <Cell align="right">
                  {/* "Review" only while someone still has to act on it; a finished return is just looked at. */}
                  <ButtonLink to={`/orders/${r.order}`} variant="ghost" size="sm">
                    {actionable.includes(r.status) ? 'Review' : 'View'}
                  </ButtonLink>
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
