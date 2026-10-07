import { Product } from '../../models/index.js';
import { AppError, invalid } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';

export const MAX_QTY = 10;

// Validates the cart payload and merges duplicate product ids. Checkout and the discount preview both
// start here, so they accept exactly the same carts.
export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw invalid({ items: 'Your cart is empty.' });
  if (items.length > 50) throw invalid({ items: 'A single checkout can include at most 50 products.' });
  const merged = new Map();
  for (const item of items) {
    const qty = Number(item?.qty);
    if (!isId(item?.productId) || !Number.isInteger(qty) || qty < 1) {
      throw invalid({ items: 'Each item needs a product and a whole-number quantity.' });
    }
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + qty);
  }
  for (const qty of merged.values()) {
    if (qty > MAX_QTY) throw invalid({ items: `You can order at most ${MAX_QTY} of one item.` });
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

// The error for a cart line that can't be bought: unlisted or gone, or not enough stock.
export function cartLineError(product, productId) {
  if (!product?.isActive) {
    return new AppError(409, 'UNAVAILABLE', `${product?.name ?? 'An item in your cart'} is no longer available.`, {
      details: { productId },
    });
  }
  const message = product.stock === 0 ? `${product.name} is sold out.` : `Only ${product.stock} left of ${product.name}.`;
  return new AppError(409, 'OUT_OF_STOCK', message, { details: { productId, stock: product.stock } });
}

export function ownProductError(productId) {
  return new AppError(422, 'OWN_PRODUCT', "You can't buy your own product.", { details: { productId } });
}

export function assertCanShop(user) {
  if (user.role === 'admin') throw new AppError(403, 'FORBIDDEN', "Admin accounts can't place orders.");
  if (user.role === 'rider') throw new AppError(403, 'FORBIDDEN', "Rider accounts can't place orders.");
}

// Read-only version of checkout's checks, for the discount preview: the same errors checkout would
// raise, without reserving stock. Returns the subtotal from database prices.
export async function checkCart(items, user) {
  assertCanShop(user);
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }, 'name priceCents stock isActive seller');
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  let subtotalCents = 0;
  for (const { productId, qty } of items) {
    const product = byId.get(productId);
    if (!product?.isActive || product.stock < qty) throw cartLineError(product, productId);
    if (product.seller.equals(user._id)) throw ownProductError(productId);
    subtotalCents += product.priceCents * qty;
  }
  return subtotalCents;
}
