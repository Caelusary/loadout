import { api } from '../../lib/api.js';

// One order, shared by its page and LinkPrefetch. `reviewedProducts` lists the products on it the customer has
// already rated.
export const orderQuery = (id) => ({
  queryKey: ['order', id],
  queryFn: ({ signal }) =>
    api(`/orders/${id}`, { signal }).then((r) => ({ ...r.order, reviewedProducts: r.reviewed ?? [] })),
});
