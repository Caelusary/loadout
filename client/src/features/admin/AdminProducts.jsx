import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Price, Tag } from '../../components/ui/chips.jsx';
import { Pagination } from '../../components/ui/controls.jsx';
import { ErrorState, Skeleton, EmptyState } from '../../components/ui/feedback.jsx';
import { Cell, Table } from '../../components/ui/Table.jsx';
import { api, sizedImageUrl, toQuery } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';

export default function AdminProducts() {
  useTitle('Products');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = { includeInactive: '1', q: search, page, limit: 20 };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: ({ signal }) => api(`/products${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const moderate = useMutation({
    mutationFn: ({ id, changes }) => api(`/admin/products/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: (res, { changes }) => {
      const p = res.product;
      toast.show('isFeatured' in changes ? (p.isFeatured ? `${p.name} is featured` : `${p.name} is no longer featured`) : p.isActive ? `${p.name} is listed` : `${p.name} is unlisted`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error(err.message),
  });
  const busy = (id, key) => moderate.isPending && moderate.variables?.id === id && key in moderate.variables.changes;

  return (
    <>
      <PanelHeader title="Products" description="Every product on the platform. Up to 8 can be featured in the homepage carousel." />
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
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : (
        <div className={isPlaceholderData ? 'opacity-60' : ''}>
          <Table
            columns={[{ label: 'Product' }, { label: 'Shop' }, { label: 'Price', align: 'right' }, { label: 'Status' }, { label: 'Moderation', align: 'right' }]}
            empty={data.items.length === 0 && <EmptyState title="No products match">Try another search.</EmptyState>}
          >
            {data.items.map((p) => (
              <tr key={p._id}>
                <Cell>
                  <div className="flex items-center gap-3">
                    <div className="size-10 shrink-0 overflow-hidden rounded-control bg-plate">
                      {p.images[0] && <img src={sizedImageUrl(p.images[0].url, 120)} alt="" className="size-full object-cover" />}
                    </div>
                    <Link to={`/p/${p.slug}`} className="max-w-56 truncate font-medium hover:text-accent-ink">
                      {p.name}
                    </Link>
                  </div>
                </Cell>
                <Cell className="text-ink-2">{p.seller?.sellerProfile?.shopName ?? 'Deleted account'}</Cell>
                <Cell align="right">
                  <Price cents={p.priceCents} was={p.compareAtCents} />
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    {p.isActive ? <Tag tone="ok">Listed</Tag> : <Tag tone={p.unlistedBy === 'admin' ? 'bad' : 'neutral'}>{p.unlistedBy === 'admin' ? 'Unlisted by admin' : 'Unlisted by seller'}</Tag>}
                    {p.isFeatured && <Tag tone="accent">Featured</Tag>}
                  </div>
                </Cell>
                <Cell align="right">
                  <div className="flex justify-end gap-1">
                    {p.isActive && (
                      <Button variant="ghost" size="sm" loading={busy(p._id, 'isFeatured')} onClick={() => moderate.mutate({ id: p._id, changes: { isFeatured: !p.isFeatured } })}>
                        {p.isFeatured ? 'Unfeature' : 'Feature'}
                      </Button>
                    )}
                    {(p.isActive || p.unlistedBy === 'admin') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={p.isActive ? 'hover:text-bad' : ''}
                        loading={busy(p._id, 'isActive')}
                        onClick={() => moderate.mutate({ id: p._id, changes: { isActive: !p.isActive } })}
                      >
                        {p.isActive ? 'Unlist' : 'Relist'}
                      </Button>
                    )}
                  </div>
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </>
  );
}
