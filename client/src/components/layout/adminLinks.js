import { useQuery } from '@tanstack/react-query';
import {
  ChartBar,
  ClockCounterClockwise,
  Cube,
  Package,
  SealCheck,
  Tag,
  UsersThree,
  ArrowUUpLeft,
  WarningCircle,
} from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../providers/AuthProvider.jsx';

// The admin panel's pages, shared by its side nav, the phone tab bar and the phone menu. `area` links show only to
// admins the owner has given that area (see ADMIN_AREAS on the server). `tab` marks an admin's four everyday pages,
// which a phone keeps in the tab bar; the rest go in the phone menu, with their waiting counts. `areas` means any one of them is enough. The people pages sit together (every account,
// then the shop applications and rider vehicle changes to approve), with Complaints, what buyers flagged, after them.
const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: ChartBar, end: true, tab: true },
  { to: '/admin/orders', label: 'Orders', icon: Package, area: 'orders', tab: true },
  { to: '/admin/returns', label: 'Returns', icon: ArrowUUpLeft, area: 'orders' },
  { to: '/admin/products', label: 'Products', icon: Cube, area: 'products' },
  { to: '/admin/coupons', label: 'Discount codes', icon: Tag, area: 'coupons' },
  { to: '/admin/users', label: 'Users', icon: UsersThree, area: 'users', tab: true },
  { to: '/admin/approvals', label: 'Approvals', icon: SealCheck, areas: ['sellers', 'users'] },
  {
    to: '/admin/complaints',
    label: 'Complaints',
    icon: WarningCircle,
    areas: ['users', 'orders'],
  },
  { to: '/admin/activity', label: 'Activity', icon: ClockCounterClockwise, tab: true },
];

// Each link with work waiting shows how much (pending shops, open delivery reports, escalated or stuck returns,
// rider ratings and reports to review), so nothing sits unseen just because nobody opened that page.
const COUNT_FOR = {
  '/admin/approvals': 'approvals',
  '/admin/returns': 'returns',
  '/admin/complaints': 'complaints',
};

// The links this admin may open, each with its waiting count. Off for everyone else.
export function useAdminLinks() {
  const { isAdmin, can } = useAuth();
  const { data } = useQuery({
    queryKey: ['admin', 'counts'],
    queryFn: ({ signal }) => api('/admin/counts', { signal }),
    refetchInterval: 60_000,
    enabled: isAdmin,
  });
  if (!isAdmin) return [];
  const allowed = (l) => (l.areas ? l.areas.some(can) : !l.area || can(l.area));
  return ADMIN_LINKS.filter(allowed).map((l) => ({ ...l, count: data?.counts?.[COUNT_FOR[l.to]] }));
}
