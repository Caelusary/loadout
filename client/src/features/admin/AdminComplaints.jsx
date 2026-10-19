import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Tag } from '../../components/ui/chips.jsx';
import { CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { TabRow } from '../../components/ui/TabRow.jsx';
import { api } from '../../lib/api.js';
import { formatDate, orderNumber } from '../../lib/format.js';
import { useAuth } from '../../providers/AuthProvider.jsx';
import { FeedbackItem } from './riderParts.jsx';

// An order its buyer says never arrived. Settling it (refund, or found it was delivered) happens on the order itself.
function DeliveryReport({ order }) {
  const issue = order.deliveryIssue;
  return (
    <li className="flex flex-col gap-2 rounded-panel border border-bad/50 bg-bad/5 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={`/orders/${order._id}`} className="font-mono font-medium hover:text-accent-ink">
          {orderNumber(order._id)}
        </Link>
        <Tag tone="bad">Not received</Tag>
        <span className="text-[13px] text-ink-3">
          {order.user?.name ?? 'A buyer'}
          {order.seller?.sellerProfile?.shopName && ` · from ${order.seller.sellerProfile.shopName}`} ·
          reported {formatDate(issue.reportedAt)}
        </span>
      </div>
      {issue.note && <p className="text-ink">&ldquo;{issue.note}&rdquo;</p>}
      <ButtonLink to={`/orders/${order._id}`} variant="secondary" size="sm" className="self-start">
        Open the order to settle it
      </ButtonLink>
    </li>
  );
}

// Everything buyers flagged, in one place: reports about a rider (which pause them until an admin clears them), rider
// ratings of 2 stars or less, and orders reported as not received. Each kind shows only to admins with its area (riders
// are the users area, deliveries the orders area) and keeps its own action. Reports about a rider come first: they're
// about safety.
export default function AdminComplaints() {
  useTitle('Complaints');
  const { can } = useAuth();
  const riders = useQuery({
    queryKey: ['admin', 'riders', 'queue'],
    queryFn: ({ signal }) => api('/admin/rider-feedback', { signal }),
    enabled: can('users'),
  });
  const deliveries = useQuery({
    queryKey: ['admin', 'orders', { status: 'reports' }],
    queryFn: ({ signal }) => api('/admin/orders?status=reports&limit=50', { signal }),
    enabled: can('orders'),
  });
  const [tab, setTab] = useState('');

  const groups = [
    can('users') && { key: 'riders', label: 'About riders', query: riders, items: riders.data?.items },
    can('orders') && {
      key: 'deliveries',
      label: 'Not received',
      query: deliveries,
      items: deliveries.data?.items,
    },
  ].filter(Boolean);
  const shown = groups.filter((g) => !tab || g.key === tab);
  const failed = shown.find((g) => g.query.isError);
  const loading = shown.some((g) => g.query.isPending);
  const total = (list) => list.reduce((n, g) => n + (g.items?.length ?? 0), 0);

  return (
    <>
      <PanelHeader
        title="Complaints"
        description="What buyers flagged: reports about a rider, low rider ratings, and orders that never arrived. A report pauses the rider until you clear them on their page."
      />
      {groups.length > 1 && (
        <TabRow
          label="Complaints"
          tabs={[['', 'All'], ...groups.map((g) => [g.key, g.label])]}
          value={tab}
          onChange={setTab}
          counts={Object.fromEntries([['', total(groups)], ...groups.map((g) => [g.key, g.items?.length])])}
        />
      )}
      {failed ? (
        <ErrorState error={failed.query.error} onRetry={failed.query.refetch} />
      ) : loading ? (
        <CardsSkeleton count={3} lines={1} field />
      ) : total(shown) === 0 ? (
        <EmptyState title="Nothing to look into">
          Reports about a rider, ratings of 2 stars or less and &ldquo;not received&rdquo; reports show up
          here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.flatMap((g) =>
            g.key === 'riders'
              ? g.items.map((item) => <FeedbackItem key={item._id} item={item} showRider />)
              : g.items.map((order) => <DeliveryReport key={order._id} order={order} />),
          )}
        </ul>
      )}
    </>
  );
}
