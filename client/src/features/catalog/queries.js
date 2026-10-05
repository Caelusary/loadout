import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, toQuery } from '../../lib/api.js';

export const useProducts = (params, options = {}) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: ({ signal }) => api(`/products${toQuery(params)}`, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  });

// Admin-picked products for the homepage's Featured row.
export const useFeatured = () =>
  useQuery({
    queryKey: ['products', 'featured'],
    queryFn: ({ signal }) => api('/products/featured', { signal }).then((r) => r.items),
    staleTime: 5 * 60_000,
  });

export const useProduct = (slug) =>
  useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => api(`/products/${slug}`, { signal }).then((r) => r.product),
  });
