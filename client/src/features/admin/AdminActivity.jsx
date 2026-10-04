import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const KINDS = {
  user: 'Users',
  seller: 'Sellers',
  product: 'Products',
  review: 'Reviews',
  order: 'Orders',
  return: 'Returns',
  coupon: 'Discount codes',
};

// Every admin can read what every admin did; only the owner can undo it.
export default function AdminActivity() {
  useTitle('Activity');
  const { isOwner } = useAuth();
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
        <select
          aria-label="Filter by what changed"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-control border border-edge bg-bg px-3 text-sm focus:border-accent-ink focus:outline-none"
        >
          <option value="">Everything</option>
          {Object.entries(KINDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : (
        <>
          <Table
            columns={[{ label: 'When' }, { label: 'Who' }, { label: 'What' }, { label: 'Undo', align: 'right' }]}
            empty={
              data.items.length === 0 && (
                <EmptyState title="Nothing yet">Admin actions show up here as they happen.</EmptyState>
              )
            }
          >
            {data.items.map((entry) => (
              <tr key={entry._id}>
                <Cell className="whitespace-nowrap text-ink-2 tabular-nums">{formatDateTime(entry.createdAt)}</Cell>
                <Cell className="font-medium">{entry.actorName}</Cell>
                <Cell>
                  <span className={entry.undoneAt ? 'text-ink-3 line-through' : 'text-ink-2'}>
                    {entry.summary.charAt(0).toUpperCase() + entry.summary.slice(1)}
                  </span>
                </Cell>
                <Cell align="right">
                  {entry.undoneAt ? (
                    <Tag>Undone by {entry.undoneByName}</Tag>
                  ) : !entry.undoable ? (
                    <span className="text-[13px] text-ink-3">Can&apos;t be undone</span>
                  ) : isOwner ? (
                    <Button variant="ghost" size="sm" onClick={() => setUndoing(entry)}>
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
