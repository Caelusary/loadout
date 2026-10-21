import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { SortMenu } from '../catalog/SortMenu.jsx';

const KINDS = {
  user: 'Users',
  seller: 'Sellers',
  product: 'Products',
  review: 'Reviews',
  order: 'Orders',
  return: 'Returns',
  coupon: 'Discount codes',
};

// The table's columns, shared with its loading placeholder so the two always match.
const ACTIVITY_COLUMNS = [
  { label: 'When', skeleton: 'two' },
  { label: 'Who', skeleton: 'line' },
  { label: 'What', skeleton: 'line' },
  // No label: on phones the button speaks for itself instead of sitting beside the word "Undo".
  { label: '', skeleton: 'button', align: 'right' },
];

// Every admin can read what every admin did; only the owner can undo it.
export default function AdminActivity() {
  useTitle('Activity');
  const { isOwner, can } = useAuth();
  // Where an entry's target can be opened, for an admin who manages that area. Other kinds (a review, a return, an
  // account) have no page of their own here, so they stay text.
  const targetLink = ({ kind, id } = {}) =>
    kind === 'order' && can('orders')
      ? `/orders/${id}`
      : kind === 'coupon' && can('coupons')
        ? '/admin/coupons'
        : kind === 'seller' && can('users')
          ? '/admin/users?role=seller'
          : null;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [undoing, setUndoing] = useState(null);
  const params = { kind, page, limit: 20 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'activity', params],
    queryFn: ({ signal }) => api(`/admin/activity${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const undo = useMutation({
    mutationFn: (entry) => api(`/admin/activity/${entry._id}/undo`, { method: 'POST' }),
    onSuccess: () => {
      toast.show('Undone');
      setUndoing(null);
      // An undo can touch users, shops, products and codes, so refresh everything the admin panel shows.
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => {
      setUndoing(null);
      toast.error(err.message);
    },
  });

  return (
    <>
      <PanelHeader
        title="Activity"
        description={
          isOwner
            ? 'Everything admins do is recorded here, including your own actions. You can undo most of it.'
            : 'Everything admins do is recorded here. Only the owner can undo an action.'
        }
      />
      <div className="mb-5">
        <SortMenu
          label="Show"
          title="Filter by what changed"
          sorts={[['', 'Everything'], ...Object.entries(KINDS)]}
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
          }}
        />
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={ACTIVITY_COLUMNS} />
      ) : (
        <>
          <Table
            columns={ACTIVITY_COLUMNS}
            empty={
              data.items.length === 0 && (
                <EmptyState title="No admin actions yet">
                  Approvals, cancellations and other admin changes show up here as they happen.
                </EmptyState>
              )
            }
          >
            {data.items.map((entry) => (
              <tr key={entry._id}>
                <Cell className="whitespace-nowrap text-ink-2 tabular-nums">
                  {formatDateTime(entry.createdAt)}
                </Cell>
                <Cell className="font-medium">{entry.actorName}</Cell>
                <Cell>
                  {targetLink(entry.target) ? (
                    <Link
                      to={targetLink(entry.target)}
                      data-cursor-skip
                      className={entry.undoneAt ? 'text-ink-3 line-through' : 'text-ink-2'}
                    >
                      {entry.summary.charAt(0).toUpperCase() + entry.summary.slice(1)}
                    </Link>
                  ) : (
                    <span className={entry.undoneAt ? 'text-ink-3 line-through' : 'text-ink-2'}>
                      {entry.summary.charAt(0).toUpperCase() + entry.summary.slice(1)}
                    </span>
                  )}
                </Cell>
                <Cell align="right" className="max-sm:justify-end max-sm:pt-2">
                  {entry.undoneAt ? (
                    <Tag>Undone by {entry.undoneByName}</Tag>
                  ) : !entry.undoable ? (
                    <span className="text-[13px] text-ink-3">Can&apos;t be undone</span>
                  ) : isOwner ? (
                    <Button variant="secondary" size="sm" onClick={() => setUndoing(entry)}>
                      Undo
                    </Button>
                  ) : (
                    <span className="text-[13px] text-ink-3">Owner only</span>
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(undoing)}
        title="Undo this?"
        confirmLabel="Undo"
        tone="primary"
        pending={undo.isPending}
        onConfirm={() => undo.mutate(undoing)}
        onClose={() => setUndoing(null)}
      >
        {undoing && `${undoing.actorName} ${undoing.summary}. Undoing puts it back the way it was before.`}
      </ConfirmDialog>
    </>
  );
}
