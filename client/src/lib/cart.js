import { MAX_QTY } from './constants.js';

// Cart state is only [{ productId, qty }]; the server stores it (/api/cart) and this reducer applies each
// change on screen right away. Names, prices and stock are always fetched fresh.
const clampQty = (qty) => Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(qty) || 1)));

export function cartReducer(items, action) {
  switch (action.type) {
    case 'add': {
      const existing = items.find((i) => i.productId === action.productId);
      if (existing) {
        return items.map((i) => (i === existing ? { ...i, qty: clampQty(i.qty + (action.qty ?? 1)) } : i));
      }
      return [...items, { productId: action.productId, qty: clampQty(action.qty ?? 1) }];
    }
    case 'set':
      return items.map((i) => (i.productId === action.productId ? { ...i, qty: clampQty(action.qty) } : i));
    case 'remove':
      return items.filter((i) => i.productId !== action.productId);
    case 'clear':
      return [];
    case 'replace':
      return action.items;
    default:
      return items;
  }
}
