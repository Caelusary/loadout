import { Product, StockAlert } from '../../models/index.js';
import { invalid, notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';
import { notify } from '../notifications/service.js';
import { assertCanShop } from '../orders/cart.js';

// Stock counts as low at this many left (the same point the shop's product list turns amber).
export const LOW_STOCK = 5;

// Runs every minute (server.js). Stock changes in many places (checkout, cancels, returns received, the product form,
// an admin's undo), so watching the numbers here catches all of them in one spot.
//  - A shop hears once when a listed product drops to LOW_STOCK or below, and again only after it's been restocked.
//  - Shoppers who asked to be told hear when a sold-out product is back, and their request is then removed.
export async function checkStock() {
  const low = await Product.find({ isActive: true, stock: { $lte: LOW_STOCK }, lowStockAlertAt: null }, 'name stock seller');
  for (const product of low) {
    const claimed = await Product.updateOne({ _id: product._id, lowStockAlertAt: null }, { lowStockAlertAt: new Date() });
    if (!claimed.modifiedCount) continue;
    await notify({
      user: product.seller,
      type: 'order',
      title: product.stock === 0 ? `${product.name} is sold out` : `${product.name} is running low`,
      body: product.stock === 0 ? 'Shoppers can ask to be told when it is back. Restock it from your products.' : `${product.stock} left. Restock it before it sells out.`,
      link: '/seller/products',
    });
  }
  await Product.updateMany({ stock: { $gt: LOW_STOCK }, lowStockAlertAt: { $ne: null } }, { $unset: { lowStockAlertAt: 1 } });

  const waitingFor = await StockAlert.distinct('product');
  if (!waitingFor.length) return;
  const back = await Product.find({ _id: { $in: waitingFor }, isActive: true, stock: { $gt: 0 } }, 'name slug');
  for (const product of back) {
    const alerts = await StockAlert.find({ product: product._id }, 'user');
    await notify(
      alerts.map((a) => ({
        user: a.user,
        type: 'order',
        title: `${product.name} is back in stock`,
        body: 'You asked us to tell you. It may sell out again, so grab it while it lasts.',
        link: `/p/${product.slug}`,
      })),
    );
    await StockAlert.deleteMany({ _id: { $in: alerts.map((a) => a._id) } });
  }
}

async function soldOutProduct(req) {
  const product = isId(req.params.id) ? await Product.findOne({ _id: req.params.id, isActive: true }, 'stock seller') : null;
  if (!product) throw notFound('That product');
  return product;
}

export async function getStockAlert(req, res) {
  const product = await soldOutProduct(req);
  res.json({ subscribed: Boolean(await StockAlert.exists({ user: req.user._id, product: product._id })) });
}

// "Notify me": only for a sold-out product, and only for accounts that shop.
export async function subscribeStockAlert(req, res) {
  const product = await soldOutProduct(req);
  assertCanShop(req.user);
  if (product.stock > 0) throw invalid({ product: "It's in stock now. Add it to your cart." });
  await StockAlert.updateOne({ user: req.user._id, product: product._id }, {}, { upsert: true });
  res.json({ subscribed: true });
}

export async function unsubscribeStockAlert(req, res) {
  const product = await soldOutProduct(req);
  await StockAlert.deleteOne({ user: req.user._id, product: product._id });
  res.json({ subscribed: false });
}
