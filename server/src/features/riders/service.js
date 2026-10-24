import { Order, RiderFeedback, User } from '../../models/index.js';
import { ON_THE_WAY } from '../../models/Order.js';
import { canManage } from '../../middleware/auth.js';
import { notify, orderNotices } from '../notifications/service.js';
import { orderNumber as shortId } from '../../lib/format.js';
import { invalid } from '../../lib/AppError.js';

// The rider's side of a report: a few sentences, once. Shared with "not received" reports (orders/receipt.js).
export function replyText(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (text.length < 10) throw invalid({ text: 'Tell us what happened in at least 10 characters.' });
  if (text.length > 500) throw invalid({ text: 'Keep it under 500 characters.' });
  return text;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Dispatch ranks riders by rating, smoothed toward 4 stars as if each had 10 extra 4-star ratings, so a new rider
// isn't sunk (or crowned) by their first one.
const PRIOR_STARS = 4;
const PRIOR_WEIGHT = 10;
export const smoothedRating = ({ sum = 0, count = 0 } = {}) =>
  (sum + PRIOR_STARS * PRIOR_WEIGHT) / (count + PRIOR_WEIGHT);

// Admins hear about a rider whose plain average falls below 3 stars over at least 5 ratings (once, until it climbs
// back to 3.3), and about one who declines 3 orders in a week.
export const LOW_RATING = 3;
const LOW_RATING_RECOVERED = 3.3;
const LOW_RATING_MIN_COUNT = 5;
export const DECLINE_ALERT = 3;
export const DECLINE_WINDOW_DAYS = 7;

export const adminsFor = async (area) =>
  (await User.find({ role: 'admin', isActive: true })).filter((a) => canManage(a, area)).map((a) => a._id);

// Rating sums and counts for these riders (all of them when none are given).
export async function ratingTotals(riderIds) {
  const rows = await RiderFeedback.aggregate([
    { $match: { stars: { $gte: 1 }, ...(riderIds && { rider: { $in: riderIds } }) } },
    { $group: { _id: '$rider', sum: { $sum: '$stars' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { sum: r.sum, count: r.count }]));
}

// The rider for an order about to go out: active, not on hold (paused riders get nothing), not one who already
// declined it. A free rider always comes before a busy one, and among the free the highest rated goes first; when
// everyone has deliveries, the one with the fewest gets it, highest rated first again. Ties go to the
// longest-serving rider. Null when nobody can take it.
export async function pickRider(session, exclude = []) {
  const riders = await User.find(
    { role: 'rider', isActive: true, 'riderProfile.heldAt': null, _id: { $nin: exclude } },
    '_id',
  )
    .sort({ createdAt: 1, _id: 1 })
    .session(session ?? null);
  if (!riders.length) return null;
  const ids = riders.map((r) => r._id);
  const [load, ratings] = await Promise.all([
    Order.aggregate([
      { $match: { rider: { $in: ids }, status: { $in: ON_THE_WAY } } },
      { $group: { _id: '$rider', n: { $sum: 1 } } },
    ]).session(session ?? null),
    ratingTotals(ids),
  ]);
  const busy = new Map(load.map((r) => [String(r._id), r.n]));
  const onTheWay = (id) => busy.get(String(id)) ?? 0;
  const rating = (id) => smoothedRating(ratings.get(String(id)));
  // `ids` is longest-serving first, so keeping the earlier rider on a full tie settles it.
  const better = (a, b) => onTheWay(a) < onTheWay(b) || (onTheWay(a) === onTheWay(b) && rating(a) > rating(b));
  return ids.reduce((best, id) => (better(id, best) ? id : best));
}

const declinedBy = (order) => (order.declines ?? []).map((d) => d.rider);

// Moves an order that's waiting for pickup from `from` to the next rider. With nobody free it waits unassigned,
// the shop and order admins are told, and assignWaiting() hands it out once someone is.
export async function reassign(order, from) {
  const next = await pickRider(null, [from, ...declinedBy(order)]);
  const moved = await Order.findOneAndUpdate(
    { _id: order._id, status: 'shipped', rider: from },
    next ? { rider: next } : { $unset: { rider: 1 } },
    { new: true },
  );
  if (!moved) return null;
  if (next) {
    await notify(orderNotices.assigned(moved));
  } else {
    const admins = await adminsFor('orders');
    const waiting = (user, body) => ({
      user,
      type: 'order',
      title: `Order ${shortId(moved._id)} is waiting for a rider`,
      body,
      link: `/orders/${moved._id}`,
    });
    await notify([
      waiting(
        moved.seller,
        "Its rider couldn't take it and nobody else is free yet. It goes to the next free rider automatically.",
      ),
      ...admins.map((a) =>
        waiting(a, 'No rider is free to take it. It goes to the next free rider automatically.'),
      ),
    ]);
  }
  return moved;
}

// Orders waiting for pickup with no rider (everyone declined or was on hold). Runs every minute with the sales job.
export async function assignWaiting() {
  const waiting = await Order.find({ status: 'shipped', rider: null }, '_id declines');
  for (const order of waiting) {
    const next = await pickRider(null, declinedBy(order));
    if (!next) continue; // nobody who hasn't declined this one is free
    const assigned = await Order.findOneAndUpdate(
      { _id: order._id, status: 'shipped', rider: null },
      { rider: next },
      { new: true },
    );
    if (assigned) await notify(orderNotices.assigned(assigned));
  }
}

// Pauses a rider from new deliveries: orders they haven't picked up go to others, ones already out carry on.
export async function holdRider(riderId, reason, body) {
  const rider = await User.findOneAndUpdate(
    { _id: riderId, role: 'rider', 'riderProfile.heldAt': null },
    { 'riderProfile.heldAt': new Date(), 'riderProfile.heldReason': reason },
    { new: true },
  );
  if (!rider) return null; // not a rider, or already on hold
  const waiting = await Order.find({ rider: riderId, status: 'shipped' }, '_id declines');
  for (const order of waiting) await reassign(order, riderId);
  await notify({
    user: riderId,
    type: 'account',
    title: "You're paused from new deliveries",
    body: body ?? 'An admin is looking at a report about one of your deliveries. Orders already out with you carry on as normal.',
    link: '/account/rider',
  });
  return rider;
}

// After a new rating: tells admins once when the average drops below 3 stars, and re-arms when it recovers.
export async function checkRatingAlert(riderId) {
  const totals = (await ratingTotals([riderId])).get(String(riderId));
  if (!totals || totals.count < LOW_RATING_MIN_COUNT) return;
  const average = totals.sum / totals.count;
  const rider = await User.findById(riderId, 'name riderProfile');
  if (average < LOW_RATING && !rider.riderProfile?.lowRatingAlertAt) {
    await User.updateOne({ _id: riderId }, { 'riderProfile.lowRatingAlertAt': new Date() });
    const admins = await adminsFor('users');
    await notify(
      admins.map((user) => ({
        user,
        type: 'account',
        title: `${rider.name}'s rating fell below ${LOW_RATING} stars`,
        body: `${average.toFixed(1)} stars over ${totals.count} ratings. Open their record to read them.`,
        link: `/admin/riders/${riderId}`,
      })),
    );
  } else if (average >= LOW_RATING_RECOVERED && rider.riderProfile?.lowRatingAlertAt) {
    await User.updateOne({ _id: riderId }, { $unset: { 'riderProfile.lowRatingAlertAt': 1 } });
  }
}

export const declinesSince = (riderId, since) =>
  Order.aggregate([
    { $match: { 'declines.rider': riderId } },
    { $unwind: '$declines' },
    { $match: { 'declines.rider': riderId, 'declines.at': { $gte: since } } },
    { $count: 'n' },
  ]).then((rows) => rows[0]?.n ?? 0);

// A rider's numbers, for their own profile and the admin Riders page.
export async function riderStats(riderId) {
  const since = new Date(Date.now() - DECLINE_WINDOW_DAYS * DAY_MS);
  const [delivered, onTheWay, totals, declines, upheld] = await Promise.all([
    Order.countDocuments({ rider: riderId, status: 'delivered' }),
    Order.countDocuments({ rider: riderId, status: { $in: ON_THE_WAY } }),
    ratingTotals([riderId]),
    declinesSince(riderId, since),
    Order.countDocuments({ rider: riderId, 'deliveryIssue.status': 'resolved' }),
  ]);
  const t = totals.get(String(riderId)) ?? { sum: 0, count: 0 };
  return {
    delivered,
    onTheWay,
    ratingAvg: t.count ? Math.round((t.sum / t.count) * 10) / 10 : null,
    ratingCount: t.count,
    declinesThisWeek: declines,
    upheldDeliveryReports: upheld,
  };
}
