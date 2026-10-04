import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';

const TABS = [
  ['pending', 'Applications'],
  ['approved', 'Active sellers'],
  ['suspended', 'Declined or suspended'],
];

export default function AdminSellers() {
  useTitle('Sellers');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState(null);
  const params = { status, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'sellers', params],
    queryFn: ({ signal }) => api(`/admin/sellers${toQuery(params)}`, { signal }),
  });

  const update = useMutation({
    mutationFn: ({ id, next }) => api(`/admin/sellers/${id}`, { method: 'PATCH', body: { status: next } }),
    onSuccess: (res, { next }) => {
      setSuspending(null);
      const shop = res.user.sellerProfile.shopName;
      toast.show(next === 'approved' ? `${shop} can now sell` : `${shop} is suspended and its products are unlisted`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PanelHeader title="Sellers" description="Approve new shops, and suspend shops that break the rules." />
      <div role="tablist" aria-label="Seller status" className="mb-5 flex gap-1 overflow-x-auto">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className="h-9 shrink-0 rounded-control px-3 text-[13px] text-ink-2 hover:text-ink aria-selected:bg-raised aria-selected:text-ink"
          >
            {label}
          </button>
        ))}
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-40 rounded-panel" />
      ) : data.items.length === 0 ? (
        <EmptyState title={status === 'pending' ? 'No applications waiting' : 'Nobody here'}>
          {status === 'pending' ? 'New seller applications will appear here.' : 'Sellers with this status will appear here.'}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((u) => (
            <li key={u._id} className="flex flex-col gap-3 rounded-panel border border-seam p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium">
                  {status === 'approved' ? (
                    <Link to={`/s/${u.sellerProfile.slug}`} className="hover:text-accent-ink">
                      {u.sellerProfile.shopName}
                    </Link>
                  ) : (
                    u.sellerProfile.shopName
                  )}
                </p>
                <p className="text-[13px] text-ink-3">
                  {u.name}, {u.email}, applied {formatDate(u.sellerProfile.appliedAt)}
                </p>
                {u.sellerProfile.bio && <p className="max-w-[60ch] text-sm text-ink-2">{u.sellerProfile.bio}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {status !== 'approved' && (
                  <Button
                    size="sm"
                    loading={update.isPending && update.variables?.id === u._id && update.variables.next === 'approved'}
                    onClick={() => update.mutate({ id: u._id, next: 'approved' })}
                  >
                    {status === 'pending' ? 'Approve' : 'Reinstate'}
                  </Button>
                )}
                {status !== 'suspended' && (
                  <Button variant="danger" size="sm" onClick={() => setSuspending(u)}>
                    {status === 'pending' ? 'Decline' : 'Suspend'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}
      <ConfirmDialog
        open={Boolean(suspending)}
        title={status === 'pending' ? `Decline ${suspending?.sellerProfile.shopName}?` : `Suspend ${suspending?.sellerProfile.shopName}?`}
        confirmLabel={status === 'pending' ? 'Decline application' : 'Suspend seller'}
        pending={update.isPending}
        onConfirm={() => update.mutate({ id: suspending._id, next: 'suspended' })}
        onClose={() => setSuspending(null)}
      >
        {status === 'pending'
          ? 'They will not be able to apply again with this account.'
          : 'All of their products are unlisted right away. Reinstating them later does not relist products automatically.'}
      </ConfirmDialog>
    </>
  );
}
