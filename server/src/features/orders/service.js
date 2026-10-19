import { Order, Product } from '../../models/index.js';
import { ON_THE_WAY } from '../../models/Order.js';
import { releaseCouponIfCheckoutVoid } from '../coupons/service.js';
import { notify, orderNotices } from '../notifications/service.js';
import { orderNumber } from '../../lib/format.js';

export const OPEN_STATUSES = ['placed', 'processing', ...ON_THE_WAY];
// Not yet handed to the courier, so the stock is still on the seller's shelf and can be counted back.
export const UNSHIPPED = ['placed', 'processing'];

// A rider needs the buyer's name, street and phone to deliver, and not a minute longer: once an order is
// delivered or cancelled the rider's copy keeps only the city, so a rider can't look a buyer up afterwards.
// The buyer's note in a delivery report is never theirs to read. Takes and returns plain JSON.
export function riderCopy(order) {
  const { deliveryIssue, shippingAddress: to, user, ...rest } = order;
  const done = !OPEN_STATUSES.includes(order.status);
  return {
    ...rest,
    user: user && { _id: user._id, name: user.name }, // never the buyer's email
    shippingAddress: done && to ? { city: to.city, province: to.province } : to,
    ...(deliveryIssue && { deliveryIssue: { ...deliveryIssue, note: undefined } }),
  };
}
// The shop packs the order and hands it to a rider; it never contacts or ships to the buyer itself. So it sees who
// ordered (their name) and roughly where (the city), never their email, street or phone. Takes and returns plain JSON.
export function shopCopy(order) {
  const { shippingAddress: to, user, ...rest } = order;
  return {
    ...rest,
    user: user && { _id: user._id, name: user.name },
    shippingAddress: to && { city: to.city, province: to.province },
  };
}

export const AUTO_DELIVER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Cancels every matching unshipped order inside the caller's transaction: each one restocks its items
// and gives back a discount code's use once its whole checkout is cancelled. Returns the cancelled orders.
export async function cancelOrders(filter, { by, reason }, session) {
  const orders = await Order.find({ ...filter, status: { $in: UNSHIPPED } }, '_id').session(session);
  const cancelled = [];
  for (const { _id } of orders) {
    const order = await Order.findOneAndUpdate(
      { _id, status: { $in: UNSHIPPED } },
      {
        status: 'cancelled',
        cancelledBy: by,
        ...(reason && { cancelReason: reason }),
        $push: { statusHistory: { status: 'cancelled', at: new Date() } },
      },
      { new: true, session },
    );
    if (!order) continue;
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } }, { session });
    }
    await releaseCouponIfCheckoutVoid(order, session);
    cancelled.push(order);
  }
  return cancelled;
}

// Run again once the transaction has committed. Two orders from one checkout cancelled at the same
// moment each see the other as still open inside their own transaction; after commit the last one
// sees both cancelled. The release only matches while the customer still holds the use, so it can't
// happen twice.
export const releaseCouponsAfterCommit = (orders) =>
  Promise.all(orders.map((order) => releaseCouponIfCheckoutVoid(order)));

// Tells both sides about orders cancelled for a reason other than the customer's own choice.
// `skip` is an account that was just deleted, which has nobody left to read them.
export const noticesForCancelled = (orders, { skip } = {}) =>
  notify(
    orders
      .flatMap((order) => [orderNotices.toCustomer(order), orderNotices.cancelledForSeller(order, order.cancelledBy)])
      .filter((notice) => !skip || String(notice.user) !== String(skip)),
  );

// Dispatch lives with the riders (ratings, holds and declines all feed into it).
export { pickRider } from '../riders/service.js';

// Orders shipped more than 7 days ago that the rider never marked delivered count as delivered. Runs at start-up and
// hourly (see server.js); each order is claimed with a conditional update, so overlapping runs are safe.
export async function autoCompleteShipped(now = new Date()) {
  const cutoff = new Date(now.getTime() - AUTO_DELIVER_DAYS * DAY_MS);
  const due = await Order.find(
    // A missed delivery waits for the rider's next try instead (the buyer may have asked for a later day).
    { status: { $in: ON_THE_WAY }, attempts: { $exists: false }, statusHistory: { $elemMatch: { status: 'shipped', at: { $lte: cutoff } } } },
    '_id statusHistory',
  );
  const done = [];
  for (const { _id, statusHistory } of due) {
    // Dated 7 days after shipping, not when this run happened, so downtime can't stretch the return window.
    const shippedAt = [...statusHistory].reverse().find((h) => h.status === 'shipped').at;
    const at = new Date(shippedAt.getTime() + AUTO_DELIVER_DAYS * DAY_MS);
    const order = await Order.findOneAndUpdate(
      { _id, status: { $in: ON_THE_WAY }, attempts: { $exists: false } },
      { status: 'delivered', deliveredBy: 'auto', $push: { statusHistory: { status: 'delivered', at } } },
      { new: true },
    );
    if (order) done.push(order);
  }
  await notify(
    done.flatMap((order) => [
      orderNotices.toCustomer(order),
      {
        user: order.seller,
        type: 'order',
        title: `Order ${orderNumber(order._id)} completed`,
        body: `The rider didn't mark it delivered within ${AUTO_DELIVER_DAYS} days of shipping, so it counts as delivered.`,
        link: `/orders/${order._id}`,
      },
    ]),
  );
  return done.length;
}
