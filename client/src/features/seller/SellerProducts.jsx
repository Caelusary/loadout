import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { Price, Tag } from '../../components/ui/chips.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, sizedImageUrl } from '../../lib/api.js';
import { CATEGORY_SINGULAR } from '../../lib/constants.js';
import { useToast } from '../../providers/ToastProvider.jsx';

export const useMyProducts = () =>
  useQuery({ queryKey: ['products', 'mine'], queryFn: ({ signal }) => api('/products/mine', { signal }).then((r) => r.items) });

function ListingTag({ product }) {
  if (product.isActive) return <Tag tone="ok">Listed</Tag>;
  return <Tag tone={product.unlistedBy === 'admin' ? 'bad' : 'neutral'}>{product.unlistedBy === 'admin' ? 'Unlisted by admin' : 'Unlisted'}</Tag>;
}

export default function SellerProducts() {
  useTitle('Your products');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useMyProducts();
  const [removing, setRemoving] = useState(null);

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
        action={<ButtonLink to="/seller/products/new" size="sm">Add product</ButtonLink>}
      />
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : data.length === 0 ? (
        <EmptyState title="No products yet" action={<ButtonLink to="/seller/products/new">Add your first product</ButtonLink>}>
          Products you add appear in the shop as soon as you save them.
        </EmptyState>
      ) : (
        <Table
          columns={[
            { label: 'Product' },
            { label: 'Price', align: 'right' },
            { label: 'Stock', align: 'right' },
            { label: 'Status' },
            { label: 'Actions', align: 'right' },
          ]}
        >
          {data.map((p) => (
            <tr key={p._id}>
              <Cell>
                <div className="flex items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-control bg-plate">
                    {p.images[0] && <img src={sizedImageUrl(p.images[0].url, 120)} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <Link to={`/p/${p.slug}`} className="truncate font-medium hover:text-accent-ink">
                      {p.name}
                    </Link>
                    <span className="text-[12px] text-ink-3">{CATEGORY_SINGULAR[p.category]}</span>
                  </div>
                </div>
              </Cell>
              <Cell align="right">
                <Price cents={p.priceCents} was={p.compareAtCents} />
              </Cell>
              <Cell align="right" className={`font-mono tabular-nums ${p.stock === 0 ? 'text-bad' : p.stock <= 5 ? 'text-warn' : ''}`}>
                {p.stock}
              </Cell>
              <Cell>
                <ListingTag product={p} />
              </Cell>
              <Cell align="right">
                <div className="flex justify-end gap-1">
                  <ButtonLink to={`/seller/products/${p._id}/edit`} variant="ghost" size="sm">
                    Edit
                  </ButtonLink>
                  {p.unlistedBy !== 'admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={toggle.isPending && toggle.variables?._id === p._id}
                      onClick={() => toggle.mutate(p)}
                    >
                      {p.isActive ? 'Unlist' : 'List'}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="hover:text-bad" onClick={() => setRemoving(p)}>
                    Delete
                  </Button>
                </div>
              </Cell>
            </tr>
          ))}
        </Table>
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
