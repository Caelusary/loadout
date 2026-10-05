import { Product, User } from '../../models/index.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';
import { cartLineError, MAX_QTY, ownProductError } from '../orders/cart.js';

const MAX_LINES = 50;

// The client gets ids, quantities and the price each item had when added (to say it has changed);
// the live names, prices and stock come from /products.
const view = (cart) => ({
  items: cart.map((line) => ({ productId: line.product.toString(), qty: line.qty, addedPriceCents: line.priceCents })),
});

const copy = (cart) => [...(cart ?? [])].map((l) => ({ product: l.product, qty: l.qty, priceCents: l.priceCents }));

function readQty(body) {
  const qty = Number(body?.qty ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    throw invalid({ qty: `Quantity must be a whole number from 1 to ${MAX_QTY}.` });
  }
  return qty;
}

// The same rules checkout applies: a listed product, not your own, and no more than is in stock.
async function buyable(productId, user, qty) {
  if (!isId(productId)) throw notFound('That product');
  const product = await Product.findById(productId, 'name stock isActive seller priceCents');
  if (!product) throw notFound('That product');
  if (product.seller.equals(user._id)) throw ownProductError(productId);
  if (!product.isActive || product.stock < qty) throw cartLineError(product, productId);
  return product;
}

async function save(user, cart) {
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { cart } },
    { new: true, runValidators: true },
  );
  return view(updated.cart);
}

const findLine = (cart, productId) => cart.find((line) => line.product.toString() === productId);

export async function getCart(req, res) {
  res.json(view(req.user.cart ?? []));
}

// Adds to what's already in the cart (a second "Add to cart" means more of the same item).
export async function addToCart(req, res) {
  const { productId } = req.params;
  const qty = readQty(req.body);
  const cart = copy(req.user.cart);
  const line = findLine(cart, productId);
  const total = (line?.qty ?? 0) + qty;
  if (total > MAX_QTY) throw invalid({ qty: `You can order at most ${MAX_QTY} of one item.` });
  const product = await buyable(productId, req.user, total);
  // Adding again counts as seeing the current price, so any "price changed" note clears.
  if (line) Object.assign(line, { qty: total, priceCents: product.priceCents });
  else {
    if (cart.length >= MAX_LINES) {
      throw new AppError(
        422,
        'CART_FULL',
        `Your cart can hold ${MAX_LINES} different products. Check out or remove some first.`,
      );
    }
    cart.push({ product: productId, qty, priceCents: product.priceCents });
  }
  res.json(await save(req.user, cart));
}

// Sets the quantity of an item already in the cart.
export async function setCartQty(req, res) {
  const { productId } = req.params;
  const qty = readQty(req.body);
  const cart = copy(req.user.cart);
  const line = findLine(cart, productId);
  if (!line) throw notFound('That item in your cart');
  const product = await buyable(productId, req.user, qty);
  line.qty = qty;
  // The cart's "OK" on a price note sends acknowledgePrice, which takes the current price as seen.
  if (req.body?.acknowledgePrice === true) line.priceCents = product.priceCents;
  res.json(await save(req.user, cart));
}

export async function removeFromCart(req, res) {
  if (!isId(req.params.productId)) throw notFound('That item in your cart');
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { cart: { product: req.params.productId } } },
    { new: true },
  );
  res.json(view(updated.cart));
}

export async function clearCart(req, res) {
  const updated = await User.findByIdAndUpdate(req.user._id, { $set: { cart: [] } }, { new: true });
  res.json(view(updated.cart));
}
