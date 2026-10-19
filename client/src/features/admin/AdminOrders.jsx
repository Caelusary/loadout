import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { TabRow } from '../../components/ui/TabRow.jsx';
import { api, toQuery } from '../../lib/api.js';
import { ORDER_STATUSES, STATUS_LABELS } from '../../lib/constants.js';
import { OrdersTable } from '../orders/OrdersTable.jsx';

// "Not received" reports live on the Complaints page with everything else buyers flagged.
const TABS = [['', 'All'], ...ORDER_STATUSES.map((s) => [s, STATUS_LABELS[s]])];

// The tab, page and shop live in the address, so the dashboard can link straight to "Placed" or one shop's orders.
export default function AdminOrders() {
  useTitle('All orders');
  const [search, setSearch] = useSearchParams();
  const status = search.get('status') ?? '';
  const seller = search.get('seller') ?? '';
  const page = Number(search.get('page')) || 1;
  const params = { status, seller, page };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: ({ signal }) => api(`/admin/orders${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });
  const go = (changes) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
        return next;
      },
      { replace: true },
    );
  const shopName = seller && data?.items[0]?.seller?.sellerProfile?.shopName;

  return (
    <>
      <PanelHeader
        title="Orders"
        description="Every order on the platform. Open one to cancel it before delivery."
      />
      {seller && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          Showing {shopName ? `${shopName}'s` : "one shop's"} orders.
          <button
            type="button"
            onClick={() => go({ seller: '', page: '' })}
            className="text-accent-ink hover:underline"
          >
            Show every shop
          </button>
        </p>
      )}
      <TabRow
        label="Filter by status"
        tabs={TABS}
        value={status}
        counts={data?.counts}
        onChange={(s) => go({ status: s, page: '' })}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <OrdersTable orders={[]} showShop={!seller} loading />
      ) : (
        <>
          <OrdersTable orders={data.items} showShop={!seller} />
          <Pagination
            page={data.page}
            pages={data.pages}
            onPage={(p) => go({ page: p > 1 ? String(p) : '' })}
          />
        </>
      )}
    </>
  );
}
