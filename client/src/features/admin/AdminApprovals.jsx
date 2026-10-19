import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { TabRow } from '../../components/ui/TabRow.jsx';
import { api, toQuery } from '../../lib/api.js';
import { formatDate, vehicleText } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

// New shops waiting to be let in. A shop already selling is suspended or reinstated from Users (the Sellers filter).
function ShopApplications() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [declining, setDeclining] = useState(null);
  const params = { status: 'pending', page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'sellers', params],
    queryFn: ({ signal }) => api(`/admin/sellers${toQuery(params)}`, { signal }),
  });
  const update = useMutation({
    mutationFn: ({ id, next }) => api(`/admin/sellers/${id}`, { method: 'PATCH', body: { status: next } }),
    onSuccess: (res, { next }) => {
      setDeclining(null);
      const shop = res.user.sellerProfile.shopName;
      toast.show(next === 'approved' ? `${shop} can now sell` : `${shop}'s application was declined`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isPending) return <CardsSkeleton count={2} lines={1} actions={2} />;
  if (data.items.length === 0) {
    return <EmptyState title="No shops waiting">New seller applications show up here.</EmptyState>;
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {data.items.map((u) => (
          <li
            key={u._id}
            className="flex flex-col gap-3 rounded-panel border border-seam p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{u.sellerProfile.shopName}</p>
              <p className="text-[13px] text-ink-3">
                {u.name}, {u.email}, applied {formatDate(u.sellerProfile.appliedAt)}
              </p>
              {u.sellerProfile.bio && (
                <p className="max-w-[60ch] text-sm text-ink-2">{u.sellerProfile.bio}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                loading={
                  update.isPending && update.variables?.id === u._id && update.variables.next === 'approved'
                }
                onClick={() => update.mutate({ id: u._id, next: 'approved' })}
              >
                Approve
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeclining(u)}>
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} pages={data.pages} onPage={setPage} />
      <ConfirmDialog
        open={Boolean(declining)}
        title={`Decline ${declining?.sellerProfile.shopName}?`}
        confirmLabel="Decline application"
        pending={update.isPending}
        onConfirm={() => update.mutate({ id: declining._id, next: 'suspended' })}
        onClose={() => setDeclining(null)}
      >
        They will not be able to apply again with this account.
      </ConfirmDialog>
    </>
  );
}

// Riders asking to change the vehicle or plate buyers look for at the door. Each opens the rider's page to decide.
function VehicleChanges() {
  const queue = useQuery({
    queryKey: ['admin', 'riders', 'queue'],
    queryFn: ({ signal }) => api('/admin/rider-feedback', { signal }),
  });
  if (queue.isError) return <ErrorState error={queue.error} onRetry={queue.refetch} />;
  if (queue.isPending) return <CardsSkeleton count={2} compact />;
  const requests = queue.data.vehicleRequests ?? [];
  if (requests.length === 0) {
    return (
      <EmptyState title="No vehicle changes waiting">
        When a rider asks to change their vehicle or plate, it waits here. Nothing changes for buyers until
        you approve.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li key={r._id}>
          <Link
            to={`/admin/riders/${r._id}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-panel border border-accent-ink/40 bg-accent/5 px-4 py-3 text-sm transition-colors hover:bg-accent/10"
          >
            <span className="font-medium">{r.name}</span>
            <span className="font-mono text-ink-2">
              {vehicleText(r.riderProfile)} →{' '}
              <span className="text-ink">{vehicleText(r.riderProfile.vehicleRequest)}</span>
            </span>
            <span className="ml-auto text-[13px] text-ink-3">
              Asked {formatDate(r.riderProfile.vehicleRequest.at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const KINDS = [
  { key: 'shops', label: 'Shops', area: 'sellers', count: 'sellers', Body: ShopApplications },
  { key: 'vehicles', label: 'Vehicle changes', area: 'users', count: 'riders', Body: VehicleChanges },
];

// What waits on an admin's yes or no: new shops, and riders' vehicle changes. Each tab only for admins with its area.
// The tab lives in the address, so the dashboard and old links can open the right one.
export default function AdminApprovals() {
  useTitle('Approvals');
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  const { data } = useQuery({
    queryKey: ['admin', 'counts'],
    queryFn: ({ signal }) => api('/admin/counts', { signal }),
  });
  const kinds = KINDS.filter((k) => can(k.area));
  // Asked for, else the first with something waiting, else the first this admin may see.
  const asked = kinds.find((k) => k.key === search.get('tab'));
  const current = asked ?? kinds.find((k) => data?.counts?.[k.count] > 0) ?? kinds[0];
  const Body = current?.Body;

  return (
    <>
      <PanelHeader
        title="Approvals"
        description="New shops, and riders changing the vehicle buyers look for. Nothing goes live until you approve it."
      />
      {kinds.length > 1 && (
        <TabRow
          label="Approvals"
          tabs={kinds.map((k) => [k.key, k.label])}
          value={current.key}
          counts={data?.counts && Object.fromEntries(kinds.map((k) => [k.key, data.counts[k.count] ?? 0]))}
          onChange={(key) => setSearch({ tab: key }, { replace: true })}
        />
      )}
      {Body && <Body />}
    </>
  );
}
