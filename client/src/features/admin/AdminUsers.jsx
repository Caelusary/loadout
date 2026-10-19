import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Checkbox, TextAreaField } from '../../components/ui/fields.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, toQuery } from '../../lib/api.js';
import { ADMIN_AREA_LABELS } from '../../lib/constants.js';
import { formatDate, plural, vehicleText } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { useToast } from '../../providers/ToastProvider.jsx';
import { TabRow } from '../../components/ui/TabRow.jsx';

const ROLE_LABELS = { customer: 'Customer', seller: 'Seller', rider: 'Rider', admin: 'Admin' };
// The role filter, as chips with a count each (for the search in use).
const ROLE_TABS = [
  ['', 'All'],
  ['customer', 'Customers'],
  ['seller', 'Sellers'],
  ['rider', 'Riders'],
  ['admin', 'Admins'],
];
const SHOP_STATUS = {
  pending: 'Applied',
  approved: 'Approved',
  rejected: 'Turned down',
  suspended: 'Suspended',
};
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
    request: (u, { cancelOrders }) =>
      api(`/admin/users/${u._id}`, {
        method: 'PATCH',
        body: { isActive: false, ...(cancelOrders && { cancelOrders }) },
      }),
    done: (u, res) =>
      `${u.name} is deactivated${res.cancelled ? ` and ${plural(res.cancelled, 'order')} cancelled` : ''}`,
  },
  delete: {
    title: (u) => `Delete ${u.name}?`,
    label: 'Delete account',
    body: 'Their reviews are removed and any products they sell are unlisted. The owner can restore the account from Activity for 30 days.',
    ordersChoice: true,
    request: (u, { cancelOrders }) =>
      api(`/admin/users/${u._id}${cancelOrders ? '?cancelOrders=1' : ''}`, { method: 'DELETE' }),
    done: (u, res) =>
      `${u.name}'s account is deleted${res.cancelled ? ` and ${plural(res.cancelled, 'order')} cancelled` : ''}`,
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
    body: "They'll get a Deliveries page, and orders are handed to them when shops mark them ready for pickup. Their cart is emptied, since riders don't shop.",
    request: (u) => api(`/admin/users/${u._id}`, { method: 'PATCH', body: { role: 'rider' } }),
    done: (u) => `${u.name} is now a rider`,
  },
  // A shop's standing (the sellers area). Approving a new shop is on the Approvals page.
  suspendShop: {
    title: (u) => `Suspend ${u.sellerProfile.shopName}?`,
    label: 'Suspend shop',
    body: 'All of their products are unlisted right away. Reinstating them later does not relist products automatically.',
    request: (u) => api(`/admin/sellers/${u._id}`, { method: 'PATCH', body: { status: 'suspended' } }),
    done: (u) => `${u.sellerProfile.shopName} is suspended and its products are unlisted`,
  },
  reinstateShop: {
    title: (u) => `Reinstate ${u.sellerProfile.shopName}?`,
    label: 'Reinstate shop',
    tone: 'primary',
    body: 'They can sell again. Their products stay unlisted until they relist them.',
    request: (u) => api(`/admin/sellers/${u._id}`, { method: 'PATCH', body: { status: 'approved' } }),
    done: (u) => `${u.sellerProfile.shopName} can sell again`,
  },
  // Pausing a rider from new deliveries, or putting them back on. Both need a note for the activity log.
  pauseRider: {
    title: (u) => `Pause ${u.name}?`,
    label: 'Pause',
    note: true,
    body: "They won't get new orders, and ones they haven't picked up go to other riders. Orders already out carry on.",
    request: (u, { note }) =>
      api(`/admin/riders/${u._id}/hold`, { method: 'PATCH', body: { action: 'hold', note } }),
    done: (u) => `${u.name} is paused`,
  },
  resumeRider: {
    title: (u) => `Put ${u.name} back on deliveries?`,
    label: 'Resume deliveries',
    tone: 'primary',
    note: true,
    body: 'New orders will go to them again. Only do this once you have looked into what paused them.',
    request: (u, { note }) =>
      api(`/admin/riders/${u._id}/hold`, { method: 'PATCH', body: { action: 'clear', note } }),
    done: (u) => `${u.name} is back on deliveries`,
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

// Two areas by name, then a count, so an admin's row stays two lines; the full list is in the tooltip and Edit access.
const areaSummary = (areas) =>
  [...areas.slice(0, 2).map((a) => AREAS[a]), ...(areas.length > 2 ? [`+${areas.length - 2}`] : [])].join(
    ' · ',
  );

// What matters about an account for its role, under its join date: a customer's orders, a seller's shop and listings,
// a rider's vehicle and rating (and a vehicle change waiting), an admin's areas. Paused or suspended shows in Status.
function Details({ u }) {
  const p = u.riderProfile ?? {};
  const line =
    u.role === 'customer' ? (
      plural(u.orderCount ?? 0, 'order')
    ) : u.role === 'seller' ? (
      [u.sellerProfile?.shopName, SHOP_STATUS[u.sellerProfile?.status], plural(u.listedCount ?? 0, 'listing')]
        .filter(Boolean)
        .join(' · ')
    ) : u.role === 'rider' ? (
      <>
        {vehicleText(p)} ·{' '}
        {u.rating?.avg == null ? 'no ratings yet' : `${u.rating.avg.toFixed(1)}★ from ${u.rating.count}`}
        {p.vehicleRequest && <span className="text-accent-ink"> · vehicle change waiting</span>}
      </>
    ) : u.isOwner ? (
      'Every area'
    ) : (
      <span title={u.adminPermissions?.map((a) => AREAS[a]).join(', ')}>
        {u.adminPermissions?.length ? areaSummary(u.adminPermissions) : 'Dashboard only'}
      </span>
    );
  return (
    <div className="flex flex-col">
      <span className="text-ink-2">{line}</span>
      <span className="text-[12px] text-ink-3">Joined {formatDate(u.createdAt)}</span>
    </div>
  );
}

// The table's columns, shared with its loading placeholder so the two always match.
const USER_COLUMNS = [
  { label: 'Name', skeleton: 'two' },
  { label: 'Role' },
  { label: 'Details', skeleton: 'two' },
  { label: 'Status', skeleton: 'tag' },
  { label: 'Actions', skeleton: 'button', align: 'right' },
];

export default function AdminUsers() {
  useTitle('Users');
  const { user: me, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // The role lives in the address, so other pages can link straight to "Riders" or "Sellers".
  const [query, setQuery] = useSearchParams();
  const role = ROLE_LABELS[query.get('role')] ? query.get('role') : '';
  const setRole = (next) =>
    setQuery(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set('role', next);
        else p.delete('role');
        return p;
      },
      { replace: true },
    );
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(null); // { user, kind }
  const [access, setAccess] = useState(null); // { user, areas } while the owner edits an admin's access
  const [cancelOrders, setCancelOrders] = useState(false);
  const [note, setNote] = useState('');
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
    setNote('');
  };
  const confirmed = useMutation({
    mutationFn: ({ user, kind }) => CONFIRMS[kind].request(user, { cancelOrders, note }),
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
    mutationFn: ({ user, areas }) =>
      api(`/admin/users/${user._id}`, { method: 'PATCH', body: { permissions: areas } }),
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
      </div>
      <TabRow
        label="Filter by role"
        tabs={ROLE_TABS}
        value={role}
        counts={
          data?.roleCounts &&
          Object.fromEntries(ROLE_TABS.map(([k]) => [k, data.roleCounts[k || 'all'] ?? 0]))
        }
        onChange={(v) => {
          setRole(v);
          setPage(1);
        }}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={USER_COLUMNS} />
      ) : (
        <>
          <Table
            columns={USER_COLUMNS}
            empty={
              data.items.length === 0 && (
                <EmptyState title="No users match">Try another search or role.</EmptyState>
              )
            }
          >
            {data.items.map((u) => (
              <tr key={u._id}>
                <Cell>
                  <div className="flex flex-col">
                    {/* A rider opens their record; a shop opens its storefront. */}
                    {u.role === 'rider' ? (
                      <Link to={`/admin/riders/${u._id}`} className="font-medium hover:text-accent-ink">
                        {u.name}
                      </Link>
                    ) : u.role === 'seller' &&
                      u.sellerProfile?.slug &&
                      u.sellerProfile.status === 'approved' ? (
                      <Link to={`/s/${u.sellerProfile.slug}`} className="font-medium hover:text-accent-ink">
                        {u.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.name}</span>
                    )}
                    <span className="text-[12px] text-ink-3">{u.email}</span>
                  </div>
                </Cell>
                <Cell className="text-ink-2">
                  <span>
                    {u.isOwner ? 'Owner' : ROLE_LABELS[u.role]}
                    {u.sellerProfile && u.role !== 'seller' && <span className="text-ink-3"> (applied)</span>}
                  </span>
                </Cell>
                <Cell>
                  <Details u={u} />
                </Cell>
                <Cell>
                  {!u.isActive ? (
                    <Tag tone="bad">Deactivated</Tag>
                  ) : u.riderProfile?.heldAt ? (
                    <Tag tone="warn">Paused</Tag>
                  ) : u.role === 'seller' && u.sellerProfile?.status === 'suspended' ? (
                    <Tag tone="bad">Suspended</Tag>
                  ) : (
                    <Tag tone="ok">Active</Tag>
                  )}
                </Cell>
                <Cell align="right">
                  {u._id === me._id ? (
                    <span className="text-[13px] text-ink-3">You</span>
                  ) : u.isOwner || (u.role === 'admin' && !me.isOwner) ? (
                    <span className="text-[13px] text-ink-3">{u.isOwner ? 'Owner' : 'View only'}</span>
                  ) : (
                    <RowMenu
                      ariaLabel={`Manage ${u.name}`}
                      groups={[
                        {
                          label: 'Role',
                          items: [
                            me.isOwner &&
                              u.role === 'customer' &&
                              !u.sellerProfile && {
                                label: 'Make admin',
                                onSelect: () => setConfirming({ user: u, kind: 'promote' }),
                              },
                            u.role === 'customer' &&
                              !u.sellerProfile && {
                                label: 'Make rider',
                                onSelect: () => setConfirming({ user: u, kind: 'makeRider' }),
                              },
                            u.role === 'rider' && {
                              label: 'Remove rider',
                              onSelect: () => setConfirming({ user: u, kind: 'removeRider' }),
                            },
                            me.isOwner &&
                              u.role === 'admin' && {
                                label: 'Edit access…',
                                onSelect: () => setAccess({ user: u, areas: u.adminPermissions ?? [] }),
                              },
                            me.isOwner &&
                              u.role === 'admin' && {
                                label: 'Remove admin',
                                onSelect: () => setConfirming({ user: u, kind: 'demote' }),
                              },
                          ].filter(Boolean),
                        },
                        u.role === 'rider' &&
                          u.isActive && {
                            label: 'Deliveries',
                            items: [
                              u.riderProfile?.heldAt
                                ? {
                                    label: 'Resume deliveries',
                                    onSelect: () => setConfirming({ user: u, kind: 'resumeRider' }),
                                  }
                                : {
                                    label: 'Pause deliveries',
                                    onSelect: () => setConfirming({ user: u, kind: 'pauseRider' }),
                                  },
                            ],
                          },
                        u.role === 'seller' &&
                          can('sellers') &&
                          ['approved', 'suspended'].includes(u.sellerProfile?.status) && {
                            label: 'Shop',
                            items: [
                              u.sellerProfile.status === 'approved'
                                ? {
                                    label: 'Suspend shop',
                                    onSelect: () => setConfirming({ user: u, kind: 'suspendShop' }),
                                  }
                                : {
                                    label: 'Reinstate shop',
                                    onSelect: () => setConfirming({ user: u, kind: 'reinstateShop' }),
                                  },
                            ],
                          },
                        {
                          label: 'Account',
                          items: [
                            {
                              label: 'Send reset email',
                              onSelect: () => setConfirming({ user: u, kind: 'resetEmail' }),
                            },
                            u.isActive
                              ? {
                                  label: 'Deactivate',
                                  onSelect: () => setConfirming({ user: u, kind: 'deactivate' }),
                                }
                              : { label: 'Reactivate', onSelect: () => toggle.mutate(u) },
                          ],
                        },
                        {
                          label: 'Danger',
                          danger: true,
                          items: [
                            {
                              label: 'Delete account',
                              onSelect: () => setConfirming({ user: u, kind: 'delete' }),
                            },
                          ],
                        },
                      ].filter(Boolean)}
                    />
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
        onConfirm={() =>
          dialog?.note && note.trim().length < 3
            ? toast.error('Add a short note first.')
            : confirmed.mutate(confirming)
        }
        onClose={closeConfirm}
      >
        <p>{dialog?.body}</p>
        {dialog?.note && (
          <div className="mt-4">
            <TextAreaField
              label="Note"
              hint="Goes in the activity log."
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
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
        <p>
          The dashboard and activity log are always open. Every change here is logged, and you can undo it.
        </p>
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
