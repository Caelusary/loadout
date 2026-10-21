import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Price, Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { ErrorState, EmptyState } from '../../components/ui/feedback.jsx';
import { TextAreaField } from '../../components/ui/fields.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';
import { TabRow } from '../../components/ui/TabRow.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, sizedImageUrl, toQuery } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// The table's columns, shared with its loading placeholder so the two always match.
// Widths fit the table to the panel (see Table): the fixed columns keep theirs and the product name takes the rest,
// truncating, so Manage never gets pushed out of view on a laptop-width screen.
const PRODUCT_COLUMNS = [
  { label: 'Product', skeleton: 'thumb' },
  { label: 'Shop', width: 130 },
  { label: 'Price', skeleton: 'short', width: 150 },
  { label: 'Status', skeleton: 'tag', width: 112 },
  { label: '', skeleton: 'button', align: 'right', width: 124 },
];

export default function AdminProducts() {
  useTitle('Products');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // Unlisting takes a product away from buyers and tells its shop, so it asks first, with an optional reason.
  const [unlisting, setUnlisting] = useState(null);
  const [reason, setReason] = useState('');
  const params = { includeInactive: '1', q: search, status, page, limit: 20 };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: ({ signal }) => api(`/products${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const moderate = useMutation({
    mutationFn: ({ id, changes }) => api(`/admin/products/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: (res, { changes }) => {
      const p = res.product;
      toast.show(
        'isFeatured' in changes
          ? p.isFeatured
            ? `${p.name} is featured`
            : `${p.name} is no longer featured`
          : p.isActive
            ? `${p.name} is listed`
            : `${p.name} is unlisted`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setUnlisting(null);
      setReason('');
    },
    onError: (err) => toast.error(err.message),
  });
  // A seller's own unlisting is theirs to undo, so the admin can only relist what an admin took down.
  const menuFor = (p) => [
    {
      label: 'Homepage',
      items: p.isActive
        ? [
            {
              label: p.isFeatured ? 'Remove from featured' : 'Feature on homepage',
              onSelect: () => moderate.mutate({ id: p._id, changes: { isFeatured: !p.isFeatured } }),
            },
          ]
        : [],
    },
    {
      label: 'Listing',
      danger: p.isActive,
      items:
        p.isActive || p.unlistedBy === 'admin'
          ? [
              {
                label: p.isActive ? 'Unlist' : 'Relist',
                onSelect: () =>
                  p.isActive ? setUnlisting(p) : moderate.mutate({ id: p._id, changes: { isActive: true } }),
              },
            ]
          : [],
    },
  ];

  return (
    <>
      <PanelHeader
        title="Products"
        description="Every product on the platform. Up to 8 can be featured in the homepage carousel."
      />
      <form
        role="search"
        className="mb-5 max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(new FormData(e.currentTarget).get('q').trim());
          setPage(1);
        }}
      >
        <input
          name="q"
          type="search"
          placeholder="Search by name or brand"
          aria-label="Search products"
          className="h-10 w-full rounded-control border border-edge bg-bg px-3 text-sm placeholder:text-ink-3 focus:border-accent-ink focus:outline-none"
        />
      </form>
      <TabRow
        label="Filter by status"
        tabs={[
          ['', 'All'],
          ['listed', 'Listed'],
          ['featured', 'Featured'],
          ['unlisted', 'Unlisted'],
        ]}
        value={status}
        counts={data?.counts}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={PRODUCT_COLUMNS} />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60' : ''}>
          {data.items.length === 0 ? (
            <EmptyState title="No products here">
              {search ? 'Try another search.' : 'Products with this status show up here.'}
            </EmptyState>
          ) : (
            <>
              {/* Phones get one compact row per product, like Seller Center's list; wider screens the table. */}
              <ul className="divide-y divide-seam rounded-panel border border-seam sm:hidden">
                {data.items.map((p) => (
                  <li key={p._id} className="flex items-center gap-3 p-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-control border border-seam bg-raised">
                      {p.images[0] && (
                        <img
                          src={sizedImageUrl(p.images[0].url, 120)}
                          alt=""
                          className="size-full object-contain p-0.5"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        to={`/p/${p.slug}`}
                        data-cursor-skip
                        className="truncate text-sm font-medium hover:text-accent-ink"
                      >
                        {p.name}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
                        <span className="truncate">
                          {p.seller?.sellerProfile?.shopName ?? 'Deleted account'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <Price cents={p.priceCents} was={p.compareAtCents} tag={false} className="text-ink" />
                      </p>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px]">
                        <span
                          className={
                            p.isActive ? 'text-ok' : p.unlistedBy === 'admin' ? 'text-bad' : 'text-ink-3'
                          }
                        >
                          {p.isActive
                            ? 'Listed'
                            : p.unlistedBy === 'admin'
                              ? 'Unlisted by admin'
                              : 'Unlisted by seller'}
                        </span>
                        {p.isFeatured && (
                          <>
                            <span aria-hidden="true" className="text-ink-3">
                              ·
                            </span>
                            <span className="text-accent-ink">Featured</span>
                          </>
                        )}
                      </p>
                    </div>
                    {menuFor(p).some((g) => g.items.length) && (
                      <RowMenu ariaLabel={`Manage ${p.name}`} groups={menuFor(p)} />
                    )}
                  </li>
                ))}
              </ul>
              <div className="max-sm:hidden">
                <Table columns={PRODUCT_COLUMNS}>
                  {data.items.map((p) => (
                    <tr key={p._id}>
                      <Cell>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="size-12 shrink-0 overflow-hidden rounded-control border border-seam bg-raised">
                            {p.images[0] && (
                              <img
                                src={sizedImageUrl(p.images[0].url, 120)}
                                alt=""
                                className="size-full object-contain p-0.5"
                              />
                            )}
                          </div>
                          <Link
                            to={`/p/${p.slug}`}
                            data-cursor-skip
                            title={p.name}
                            className="line-clamp-2 min-w-0 font-medium"
                          >
                            {p.name}
                          </Link>
                        </div>
                      </Cell>
                      <Cell className="truncate text-ink-2">
                        {p.seller?.sellerProfile?.shopName ?? 'Deleted account'}
                      </Cell>
                      <Cell>
                        <Price cents={p.priceCents} was={p.compareAtCents} />
                      </Cell>
                      <Cell>
                        <div className="flex flex-wrap gap-1.5">
                          {p.isActive ? (
                            <Tag tone="ok">Listed</Tag>
                          ) : (
                            <Tag tone={p.unlistedBy === 'admin' ? 'bad' : 'neutral'}>
                              {p.unlistedBy === 'admin' ? 'Unlisted by admin' : 'Unlisted by seller'}
                            </Tag>
                          )}
                          {p.isFeatured && <Tag tone="accent">Featured</Tag>}
                        </div>
                      </Cell>
                      <Cell align="right">
                        {menuFor(p).some((g) => g.items.length) && (
                          <RowMenu ariaLabel={`Manage ${p.name}`} groups={menuFor(p)} />
                        )}
                      </Cell>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
      <ConfirmDialog
        open={Boolean(unlisting)}
        title={`Unlist ${unlisting?.name ?? 'this product'}?`}
        confirmLabel="Unlist"
        cancelLabel="Keep it listed"
        pending={moderate.isPending}
        onConfirm={() =>
          moderate.mutate({
            id: unlisting._id,
            changes: { isActive: false, ...(reason.trim() && { reason }) },
          })
        }
        onClose={() => {
          setUnlisting(null);
          setReason('');
        }}
      >
        <div className="flex flex-col gap-3">
          <p>Buyers stop seeing it, and the shop gets a notice. You can relist it later.</p>
          <TextAreaField
            label="Reason for the shop"
            optional
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
