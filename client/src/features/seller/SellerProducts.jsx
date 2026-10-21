import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Price, Tag } from '../../components/ui/chips.jsx';
import { EmptyState, ErrorState } from '../../components/ui/feedback.jsx';
import { Cell, Table, TableSkeleton } from '../../components/ui/Table.jsx';
import { api, sizedImageUrl } from '../../lib/api.js';
import { CATEGORY_SINGULAR } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { RowMenu } from '../../components/ui/RowMenu.jsx';

export const useMyProducts = () =>
  useQuery({
    queryKey: ['products', 'mine'],
    queryFn: ({ signal }) => api('/products/mine', { signal }).then((r) => r.items),
  });

// One short line under the price: the discount and when the sale ends, or when a scheduled one starts.
function saleNote(p) {
  if (p.upcomingSale) return `Sale starts ${formatDate(p.upcomingSale.startsAt)}`;
  if (!(p.compareAtCents > p.priceCents)) return null;
  const off = `−${Math.round(((p.compareAtCents - p.priceCents) / p.compareAtCents) * 100)}%`;
  return p.saleEndsAt ? `${off} · ends ${formatDate(p.saleEndsAt)}` : off;
}

function ListingTag({ product }) {
  if (product.isActive) return <Tag tone="ok">Listed</Tag>;
  return (
    <Tag tone={product.unlistedBy === 'admin' ? 'bad' : 'neutral'}>
      {product.unlistedBy === 'admin' ? 'Unlisted by admin' : 'Unlisted'}
    </Tag>
  );
}

// The table's columns, shared with its loading placeholder so the two always match.
const PRODUCT_COLUMNS = [
  { label: 'Product', skeleton: 'thumb' },
  { label: 'Price', skeleton: 'short', width: 150 },
  { label: 'Stock', skeleton: 'short', width: 76 },
  { label: 'Status', skeleton: 'tag', width: 148 }, // fits "Unlisted by admin" on one line
  { label: 'Actions', skeleton: 'button', align: 'right', width: 168 },
];

export default function SellerProducts() {
  useTitle('Your products');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useMyProducts();
  const [removing, setRemoving] = useState(null);

  // Listing and deleting, shared by the phone rows and the table.
  const menuFor = (p) => [
    {
      label: 'Listing',
      items:
        p.unlistedBy === 'admin'
          ? []
          : [{ label: p.isActive ? 'Unlist' : 'List', onSelect: () => toggle.mutate(p) }],
    },
    { label: 'Danger', danger: true, items: [{ label: 'Delete product', onSelect: () => setRemoving(p) }] },
  ];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
  const toggle = useMutation({
    mutationFn: (p) => api(`/products/${p._id}`, { method: 'PATCH', body: { isActive: !p.isActive } }),
    onSuccess: (res) => {
      toast.show(res.product.isActive ? 'Product listed' : 'Product unlisted');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: (p) => api(`/products/${p._id}`, { method: 'DELETE' }),
    onSuccess: (res) => {
      setRemoving(null);
      toast.show(res.archived ? 'Product archived. It stays in past orders.' : 'Product deleted');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PanelHeader
        title="Products"
        description="Unlisted products are hidden from the shop but keep their history."
        action={
          <ButtonLink to="/seller/products/new" size="sm">
            Add product
          </ButtonLink>
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <TableSkeleton columns={PRODUCT_COLUMNS} />
      ) : data.length === 0 ? (
        <EmptyState
          title="No products yet"
          action={<ButtonLink to="/seller/products/new">Add your first product</ButtonLink>}
        >
          Products you add appear in the shop as soon as you save them.
        </EmptyState>
      ) : (
        <>
          {/* Phones get one compact row per product (about half the height of a labelled card); wider screens the table. */}
          <ul className="divide-y divide-seam rounded-panel border border-seam sm:hidden">
            {data.map((p) => (
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
                  <Link to={`/p/${p.slug}`} data-cursor-skip className="truncate text-sm font-medium">
                    {p.name}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
                    <Price cents={p.priceCents} was={p.compareAtCents} tag={false} className="text-ink" />
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-mono ${p.stock === 0 ? 'text-bad' : p.stock <= 5 ? 'text-warn' : ''}`}
                    >
                      {p.stock} in stock
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {p.isActive ? 'Listed' : p.unlistedBy === 'admin' ? 'Unlisted by admin' : 'Unlisted'}
                    </span>
                  </p>
                  {saleNote(p) && <span className="text-[12px] text-neon">{saleNote(p)}</span>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <ButtonLink to={`/seller/products/${p._id}/edit`} variant="secondary" size="sm">
                    Edit
                  </ButtonLink>
                  <RowMenu label="More" ariaLabel={`More for ${p.name}`} groups={menuFor(p)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="max-sm:hidden">
            <Table columns={PRODUCT_COLUMNS}>
              {data.map((p) => (
                <tr key={p._id}>
                  <Cell>
                    <div className="flex items-center gap-3">
                      {/* A lighter tile than the page so the (transparent) product photo is actually visible at this size. */}
                      <div className="size-12 shrink-0 overflow-hidden rounded-control border border-seam bg-raised">
                        {p.images[0] && (
                          <img
                            src={sizedImageUrl(p.images[0].url, 120)}
                            alt=""
                            className="size-full object-contain p-0.5"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <Link
                          to={`/p/${p.slug}`}
                          data-cursor-skip
                          title={p.name}
                          className="line-clamp-2 font-medium"
                        >
                          {p.name}
                        </Link>
                        <span className="text-[12px] text-ink-3">{CATEGORY_SINGULAR[p.category]}</span>
                      </div>
                    </div>
                  </Cell>
                  <Cell>
                    <Price cents={p.priceCents} was={p.compareAtCents} tag={false} />
                    {saleNote(p) && <span className="block text-[12px] text-neon">{saleNote(p)}</span>}
                  </Cell>
                  <Cell
                    className={`font-mono tabular-nums ${p.stock === 0 ? 'text-bad' : p.stock <= 5 ? 'text-warn' : ''}`}
                  >
                    {p.stock}
                  </Cell>
                  <Cell>
                    <ListingTag product={p} />
                  </Cell>
                  <Cell align="right">
                    {/* Edit is the everyday action, so it stays visible; listing and deleting sit in the menu. */}
                    <div className="flex items-center justify-end gap-2">
                      <ButtonLink to={`/seller/products/${p._id}/edit`} variant="secondary" size="sm">
                        Edit
                      </ButtonLink>
                      <RowMenu label="More" ariaLabel={`More for ${p.name}`} groups={menuFor(p)} />
                    </div>
                  </Cell>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Delete ${removing?.name ?? 'product'}?`}
        confirmLabel="Delete product"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      >
        If anyone has ordered it, it is archived instead so past orders stay intact.
      </ConfirmDialog>
    </>
  );
}
