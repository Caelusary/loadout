import { Coupon, ReturnRequest } from '../../models/index.js';
import { AppError } from '../../lib/AppError.js';

const peso = (cents) => `₱${(cents / 100).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const rejected = (message) => new AppError(422, 'COUPON_INVALID', message, { fields: { couponCode: message } });

function discountFor(coupon, subtotalCents) {
  const raw = coupon.type === 'percent' ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  return Math.min(raw, subtotalCents);
}

// Looks up a code and checks every rule that doesn't need a write. Used by the checkout preview and by
// checkout itself, so the two can't disagree.
export async function priceCoupon(code, user, subtotalCents, session) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) throw rejected('Enter a discount code.');
  const coupon = await Coupon.findOne({ code: normalized }).session(session ?? null);
  if (!coupon || !coupon.isActive) throw rejected("That code doesn't exist.");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw rejected('That code has expired.');
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw rejected('That code has been used up.');
  if (coupon.usedBy.some((id) => id.equals(user._id))) throw rejected("You've already used that code.");
  if (subtotalCents < coupon.minSubtotalCents) throw rejected(`That code needs a subtotal of at least ${peso(coupon.minSubtotalCents)}.`);
  return { coupon, discountCents: discountFor(coupon, subtotalCents) };
}

// Claims one use atomically, so two checkouts can't both take the last use or a customer's second use.
export async function redeemCoupon(coupon, user, session) {
  const filter = { _id: coupon._id, isActive: true, usedBy: { $ne: user._id } };
  if (coupon.maxUses) filter.usedCount = { $lt: coupon.maxUses };
  const claimed = await Coupon.findOneAndUpdate(filter, { $inc: { usedCount: 1 }, $push: { usedBy: user._id } }, { new: true, session });
  if (!claimed) throw rejected('That code is no longer available.');
  return claimed;
}

// True when every unit on the order came back through a refunded return.
async function fullyRefunded(order, session) {
  const back = await ReturnRequest.aggregate([
    { $match: { order: order._id, status: 'refunded' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', qty: { $sum: '$items.qty' } } },
  ]).session(session ?? null);
  const returned = new Map(back.map((r) => [String(r._id), r.qty]));
  return order.items.every((item) => (returned.get(String(item.product)) ?? 0) >= item.qty);
}

// Gives the customer their code use back once nothing from the checkout was kept: every order from it
// was cancelled or fully refunded. A partly kept checkout keeps the use.
export async function releaseCouponIfCheckoutVoid(order, session) {
  if (!order.couponCode) return;
  const Order = order.constructor;
  const open = await Order.find({ checkoutId: order.checkoutId, status: { $ne: 'cancelled' } }).session(session ?? null);
  for (const other of open) {
    if (!(await fullyRefunded(other, session))) return;
  }
  // The usedBy condition makes this a no-op if the use was already returned.
  await Coupon.updateOne(
    { code: order.couponCode, usedBy: order.user, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 }, $pull: { usedBy: order.user } },
    { session },
  );
}

// Splits a checkout-wide discount across the per-shop orders in proportion to their subtotals, using
// largest remainders: every share is its exact proportion rounded down or up by at most one centavo,
// so the parts add up to the whole and no shop's share can exceed that shop's own subtotal.
export function allocate(discountCents, subtotals) {
  const total = subtotals.reduce((a, b) => a + b, 0);
  if (!total || !discountCents) return subtotals.map(() => 0);
  const exact = subtotals.map((sub) => (discountCents * sub) / total);
  const shares = exact.map(Math.floor);
  let left = discountCents - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => [x - shares[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of byRemainder) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}
