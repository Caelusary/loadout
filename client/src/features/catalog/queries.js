import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, toQuery } from '../../lib/api.js';

// Each page's query, shared with LinkPrefetch so a link can start loading the page's data before the click and the
// page then finds it already in the cache under the same key.
export const productsQuery = (params) => ({
  queryKey: ['products', params],
  queryFn: ({ signal }) => api(`/products${toQuery(params)}`, { signal }),
});
export const productQuery = (slug) => ({
  queryKey: ['product', slug],
  queryFn: ({ signal }) => api(`/products/${slug}`, { signal }).then((r) => r.product),
});
export const shopQuery = (slug) => ({
  queryKey: ['shop', slug],
  queryFn: ({ signal }) => api(`/shops/${slug}`, { signal }),
});

// The shop page's address parameters that shape its product query (the rest, like ?pick, don't).
export const SHOP_FILTER_KEYS = [
  'q',
  'category',
  'brand',
  'switchType',
  'connectivity',
  'layout',
  'resolution',
  'minPrice',
  'maxPrice',
  'inStock',
  'onSale',
];
export const shopParams = (search) =>
  Object.fromEntries([...SHOP_FILTER_KEYS, 'sort', 'page'].map((k) => [k, search.get(k) ?? undefined]));

export const useProducts = (params, options = {}) =>
  useQuery({ ...productsQuery(params), placeholderData: keepPreviousData, ...options });

// Admin-picked products for the homepage's Featured row.
export const useFeatured = () =>
  useQuery({
    queryKey: ['products', 'featured'],
    queryFn: ({ signal }) => api('/products/featured', { signal }).then((r) => r.items),
    // Checked again on every visit to the homepage (the cached list shows meanwhile), so featuring changes made in
    // another tab or by another admin show up without a reload.
    staleTime: 0,
  });

export const useProduct = (slug) => useQuery(productQuery(slug));
