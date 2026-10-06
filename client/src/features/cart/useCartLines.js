import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { shippingFor } from '../../lib/constants.js';
import { useCart } from '../../providers/CartProvider.jsx';

// Joins the stored cart ({ productId, qty }) with live product data and groups it by seller,
// because each seller becomes its own order at checkout. Pass `items` to price something other than
// the cart, such as a single "Buy now" item.
export function useCartLines(items) {
  const cart = useCart();
  const list = items ?? cart.items;
  const ids = list.map((i) => i.productId).sort();
  const query = useQuery({
    queryKey: ['products', { ids }],
    queryFn: ({ signal }) => api(`/products?ids=${ids.join(',')}`, { signal }).then((r) => r.items),
    enabled: ids.length > 0,
    staleTime: 0,
  });

  const byId = new Map((query.data ?? []).map((p) => [p._id, p]));
  const lines = list.map((item) => {
    const product = byId.get(item.productId);
    const available = Boolean(product?.isActive) && product.stock > 0;
    return {
      ...item,
      product,
      available,
      overStock: available && item.qty > product.stock,
      lineCents: available ? product.priceCents * item.qty : 0,
    };
  });

  const groups = [];
  for (const line of lines) {
    const sellerId = line.product?.seller?._id ?? 'unavailable';
    let group = groups.find((g) => g.sellerId === sellerId);
    if (!group) {
      group = { sellerId, shopName: line.product?.seller?.sellerProfile?.shopName ?? 'No longer available', lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  }
  for (const g of groups) {
    g.subtotalCents = g.lines.reduce((sum, l) => sum + l.lineCents, 0);
    g.shippingCents = g.subtotalCents > 0 ? shippingFor(g.subtotalCents) : 0;
  }

  const subtotalCents = groups.reduce((sum, g) => sum + g.subtotalCents, 0);
  const shippingCents = groups.reduce((sum, g) => sum + g.shippingCents, 0);
  return {
    ...query,
    isPending: ids.length > 0 && query.isPending,
    lines,
    groups,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    hasProblems: lines.some((l) => !l.available || l.overStock),
  };
}
