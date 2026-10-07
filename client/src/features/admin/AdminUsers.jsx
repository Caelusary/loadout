import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Checkbox } from '../../components/ui/fields.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { ADMIN_AREA_LABELS } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';

const ROLE_LABELS = { customer: 'Customer', seller: 'Seller', rider: 'Rider', admin: 'Admin' };
const AREAS = ADMIN_AREA_LABELS;

// What each confirm dialog says and does. Deleting and making riders are for anyone this viewer may
// manage; making and removing admins is the owner's alone (the API enforces both).
// `ordersChoice` dialogs ask whether to also cancel the account's unshipped orders (shipped ones always
// finish; the server refuses a delete while any are on the way).
const CONFIRMS = {
  deactivate: {
    title: (u) => `Deactivate ${u.name}?`,
    label: 'Deactivate',
    body: "They're signed out and can't sign in. A seller's products are unlisted. The owner can undo this from Activity.",
    ordersChoice: true,
    request: (u, { cancelOrders }) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { isActive: false, ...(cancelOrders && { cancelOrders }) } }),
    done: (u, res) => `${u.name} is deactivated${res.cancelled ? ` and ${res.cancelled} order(s) cancelled` : ''}`,
  },
  delete: {
    title: (u) => `Delete ${u.name}?`,
    label: 'Delete account',
    body: 'Their reviews are removed and any products they sell are unlisted. The owner can restore the account from Activity for 30 days.',
    ordersChoice: true,
    request: (u, { cancelOrders }) => api(`/admin/users/${u._id}${cancelOrders ? '?cancelOrders=1' : ''}`, { method: 'DELETE' }),
    done: (u, res) => `${u.name}'s account is deleted${res.cancelled ? ` and ${res.cancelled} order(s) cancelled` : ''}`,
  },
  resetEmail: {
    title: (u) => `Email ${u.name} a reset link?`,
    label: 'Send reset email',
    tone: 'primary',
    body: "For someone who can't sign in. The link goes to their own inbox and works once for 30 minutes, so you never see or set their password.",
    request: (u) => api(`/admin/users/${u._id}/reset-email`, { method: 'POST' }),
    done: (u) => `Reset link sent to ${u.email}`,
  },
  promote: {
    title: (u) => `Make ${u.name} an admin?`,
    label: 'Make admin',
    tone: 'primary',
    body: "They'll be able to manage users, sellers, products, orders and discount codes. Their cart is emptied, since admins don't shop.",
    request: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { role: 'admin' } }),
    done: (u) => `${u.name} is now an admin`,
  },
  makeRider: {
    title: (u) => `Make ${u.name} a rider?`,
    label: 'Make rider',
    tone: 'primary',
    body: "They'll get a Deliveries page, and orders are handed to them when shops mark them shipped. Their cart is emptied, since riders don't shop.",
    request: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { role: 'rider' } }),
    done: (u) => `${u.name} is now a rider`,
  },
  removeRider: {
    title: (u) => `Remove ${u.name} as a rider?`,
    label: 'Remove rider',
    body: 'They become a customer again. This only works once they have no deliveries on the way.',
    request: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { role: 'customer' } }),
    done: (u) => `${u.name} is a customer again`,
  },
  demote: {
    title: (u) => `Remove ${u.name} as admin?`,
    label: 'Remove admin',
    body: 'They become a customer again and lose access to the admin panel right away.',
    request: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { role: 'customer' } }),
    done: (u) => `${u.name} is a customer again`,
  },
};

export default function AdminUsers() {
  useTitle('Users');
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(null); // { user, kind }
  const [access, setAccess] = useState(null); // { user, areas } while the owner edits an admin's access
  const [cancelOrders, setCancelOrders] = useState(false);
  const params = { q: search, role, page, limit: 20 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: ({ signal }) => api(`/admin/users${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
  // Activating is immediate; deactivating goes through a confirm dialog (it may cancel orders).
  const toggle = useMutation({
    mutationFn: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { isActive: true } }),
    onSuccess: (res) => {
      toast.show(`${res.user.name} can sign in again`);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const closeConfirm = () => {
    setConfirming(null);
    setCancelOrders(false);
  };
  const confirmed = useMutation({
    mutationFn: ({ user, kind }) => CONFIRMS[kind].request(user, { cancelOrders }),
    onSuccess: (res, { user, kind }) => {
      toast.show(CONFIRMS[kind].done(user, res));
      closeConfirm();
      refresh();
    },
    onError: (err) => {
      // An account with unshipped orders: keep the dialog open so the admin can tick "cancel them".
      if (err.code !== 'OPEN_ORDERS') closeConfirm();
      toast.error(err.message);
    },
  });
  const dialog = confirming && CONFIRMS[confirming.kind];

  const saveAccess = useMutation({
    mutationFn: ({ user, areas }) => api(`/admin/users/${user._id}`, { method: 'PATCH', body: { permissions: areas } }),
    onSuccess: (res) => {
      toast.show(`${res.user.name}'s access is saved`);
      setAccess(null);
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PanelHeader
        title="Users"
        description={
          me.isOwner
            ? "Deactivated accounts can't sign in. You can restore a deleted account from Activity, and you make and remove admins."
            : "Deactivated accounts can't sign in. Only the owner can restore a deleted account or manage admin accounts."
        }
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <form
          role="search"
          className="w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(new FormData(e.currentTarget).get('q').trim());
            setPage(1);
          }}
        >
          <input
            name="q"
            type="search"
            placeholder="Search by name or email"
            aria-label="Search users"
            className="h-10 w-full rounded-control border border-edge bg-bg px-3 text-sm placeholder:text-ink-3 focus:border-accent-ink focus:outline-none"
          />
        </form>
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-control border border-edge bg-bg px-3 text-sm focus:border-accent-ink focus:outline-none"
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
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
            columns={[{ label: 'Name' }, { label: 'Role' }, { label: 'Joined' }, { label: 'Status' }, { label: 'Actions', align: 'right' }]}
            empty={data.items.length === 0 && <EmptyState title="No users match">Try another search or role.</EmptyState>}
          >
            {data.items.map((u) => (
              <tr key={u._id}>
                <Cell>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-[12px] text-ink-3">{u.email}</span>
                  </div>
                </Cell>
                <Cell className="text-ink-2">
                  <span>
                    {u.isOwner ? 'Owner' : ROLE_LABELS[u.role]}
                    {u.sellerProfile && u.role !== 'seller' && <span className="text-ink-3"> (applied)</span>}
                    {u.role === 'admin' && !u.isOwner && (
                      <span className="block text-[12px] text-ink-3">
                        {u.adminPermissions?.length
                          ? u.adminPermissions.map((a) => AREAS[a]).join(', ')
                          : 'Dashboard only'}
                      </span>
                    )}
                  </span>
                </Cell>
                <Cell className="text-ink-2">{formatDate(u.createdAt)}</Cell>
                <Cell>{u.isActive ? <Tag tone="ok">Active</Tag> : <Tag tone="bad">Deactivated</Tag>}</Cell>
                <Cell align="right">
                  {u._id === me._id ? (
                    <span className="text-[13px] text-ink-3">You</span>
                  ) : u.isOwner || (u.role === 'admin' && !me.isOwner) ? (
                    <span className="text-[13px] text-ink-3">{u.isOwner ? 'Owner' : 'Owner only'}</span>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1">
                      {me.isOwner && u.role === 'customer' && !u.sellerProfile && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming({ user: u, kind: 'promote' })}>
                          Make admin
                        </Button>
                      )}
                      {u.role === 'customer' && !u.sellerProfile && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming({ user: u, kind: 'makeRider' })}>
                          Make rider
                        </Button>
                      )}
                      {u.role === 'rider' && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming({ user: u, kind: 'removeRider' })}>
                          Remove rider
                        </Button>
                      )}
                      {me.isOwner && u.role === 'admin' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setAccess({ user: u, areas: u.adminPermissions ?? [] })}>
                            Access
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirming({ user: u, kind: 'demote' })}>
                            Remove admin
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setConfirming({ user: u, kind: 'resetEmail' })}>
                        Send reset email
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={toggle.isPending && toggle.variables?._id === u._id}
                        onClick={() => (u.isActive ? setConfirming({ user: u, kind: 'deactivate' }) : toggle.mutate(u))}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="sm" className="hover:text-bad" onClick={() => setConfirming({ user: u, kind: 'delete' })}>
                        Delete
                      </Button>
                    </div>
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirming)}
        title={dialog ? dialog.title(confirming.user) : ''}
        confirmLabel={dialog?.label}
        tone={dialog?.tone}
        pending={confirmed.isPending}
        onConfirm={() => confirmed.mutate(confirming)}
        onClose={closeConfirm}
      >
        <p>{dialog?.body}</p>
        {dialog?.ordersChoice && (
          <div className="mt-4">
            <Checkbox
              label="Also cancel their unshipped orders and return the items to stock"
              checked={cancelOrders}
              onChange={(e) => setCancelOrders(e.target.checked)}
            />
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(access)}
        title={`What can ${access?.user.name ?? 'this admin'} manage?`}
        confirmLabel="Save access"
        cancelLabel="Cancel"
        tone="primary"
        pending={saveAccess.isPending}
        onConfirm={() => saveAccess.mutate(access)}
        onClose={() => setAccess(null)}
      >
        <p>The dashboard and activity log are always open. Every change here is logged, and you can undo it.</p>
        <div className="mt-4 flex flex-col gap-3">
          {Object.entries(AREAS).map(([area, label]) => (
            <Checkbox
              key={area}
              label={label}
              checked={access?.areas.includes(area) ?? false}
              onChange={(e) =>
                setAccess((a) => ({
                  ...a,
                  areas: e.target.checked ? [...a.areas, area] : a.areas.filter((x) => x !== area),
                }))
              }
            />
          ))}
        </div>
      </ConfirmDialog>
    </>
  );
}
