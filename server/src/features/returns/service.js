import { Order, Product } from '../../models/index.js';
import { RETURN_WINDOW_DAYS } from '../../models/ReturnRequest.js';
import { releaseCouponIfCheckoutVoid } from '../coupons/service.js';
import { AUTO_DELIVER_DAYS } from '../orders/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_MS = RETURN_WINDOW_DAYS * DAY_MS;
// Every return uses up its items, whatever its status: a decline can still be escalated, and an
// admin's close is final, so the same units can't be asked for again.
export const COUNTS_AGAINST_ORDER = ['requested', 'approved', 'declined', 'escalated', 'refunded', 'closed'];

// A return the shop hasn't moved for this long, or one whose shop can no longer act (suspended,
// deactivated, deleted), can be settled by an admin with the Orders area.
export const STUCK_DAYS = 3;
export const STUCK_MS = STUCK_DAYS * DAY_MS;
const shopCanAct = (seller) =>
  Boolean(seller?.isActive && seller.role === 'seller' && seller.sellerProfile?.status === 'approved');
const lastMoved = (ret) => new Date(ret.history.at(-1)?.at ?? ret.updatedAt).getTime();
export const adminCanSettle = (ret, seller, now = Date.now()) =>
  ret.status === 'escalated' ||
  (['requested', 'approved'].includes(ret.status) && (now - lastMoved(ret) > STUCK_MS || !shopCanAct(seller)));
export const statusAt = (history, status) => [...history].reverse().find((h) => h.status === status)?.at;

// A line's refund: its price times the quantity, less that share of the order's discount (the share rounds
// up, so refunds never add up to more than was paid). Shipping isn't refunded.
export function refundFor(order, line, qty) {
  const gross = line.priceCents * qty;
  const discountShare = order.subtotalCents ? Math.ceil(((order.discountCents ?? 0) * gross) / order.subtotalCents) : 0;
  return Math.max(0, gross - discountShare);
}

// When the 7 days start. A seller marking an order delivered the moment it ships would otherwise run the
// window down before the parcel arrives, so a seller's mark never starts it earlier than the automatic
// completion would have (7 days after shipping). The customer's own confirmation counts as given.
export function returnWindowStart(order) {
  const deliveredAt = new Date(statusAt(order.statusHistory, 'delivered') ?? order.updatedAt).getTime();
  const shippedAt = statusAt(order.statusHistory, 'shipped');
  if (order.deliveredBy !== 'seller' || !shippedAt) return deliveredAt;
  return Math.max(deliveredAt, new Date(shippedAt).getTime() + AUTO_DELIVER_DAYS * DAY_MS);
}

// The items are back: the refund is recorded on the order and the stock returns. If that leaves nothing
// kept from the checkout, the discount code can be used again.
export async function refund(ret, session) {
  for (const item of ret.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } }, { session });
  }
  const order = await Order.findByIdAndUpdate(ret.order, { $inc: { refundedCents: ret.refundCents } }, { session, new: true });
  await releaseCouponIfCheckoutVoid(order, session);
}
