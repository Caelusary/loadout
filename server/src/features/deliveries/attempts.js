import mongoose from 'mongoose';
import { Order, PendingPhoto, Product } from '../../models/index.js';
import { ATTEMPT_REASONS, MAX_ATTEMPTS } from '../../models/Order.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { claimUploads } from '../../lib/pendingPhotos.js';
import { releaseCouponIfCheckoutVoid } from '../coupons/service.js';
import { notify } from '../notifications/service.js';
import { riderCopy } from '../orders/service.js';
import { adminsFor } from '../riders/service.js';
import { orderNumber } from '../../lib/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// How far ahead a buyer who's away can push the next try.
export const RETRY_WINDOW_DAYS = 14;
const label = (order) => `Order ${orderNumber(order._id)}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayText = (d) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(d);

// The rider couldn't hand it over. The first miss puts it back in their list for another try (the buyer can pick a
// later day); the second sends it back to the shop: cancelled, restocked, the discount code's use given back.
export async function missedDelivery(req, res) {
  const { reason, note, proof } = req.body ?? {};
  if (!ATTEMPT_REASONS.includes(reason)) throw invalid({ reason: 'Pick what happened.' });
  if (note != null && (typeof note !== 'string' || note.length > 200)) throw invalid({ note: 'Keep the note under 200 characters.' });
  const url = proof?.url;
  // Same rule as delivering: a photo this rider just took, so a miss can't be claimed from the road.
  const own = typeof url === 'string' && (await PendingPhoto.exists({ url, user: req.user._id, kind: 'proof' }));
  if (!own) throw invalid({ proof: 'Take a photo at the door first.' });

  const attempt = { reason, photo: url, at: new Date(), ...(note?.trim() && { note: note.trim() }) };
  const result = await mongoose.connection.transaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, rider: req.user._id, status: 'out-for-delivery' },
      { $push: { attempts: attempt }, $unset: { retryOn: 1 } },
      { new: true, session },
    );
    if (!order) return null;
    if (order.attempts.length < MAX_ATTEMPTS) {
      order.status = 'shipped';
      await order.save({ session });
      return { order, returned: false };
    }
    order.status = 'cancelled';
    order.cancelledBy = 'delivery';
    order.cancelReason = `The rider couldn't deliver it after ${MAX_ATTEMPTS} tries.`;
    order.statusHistory.push({ status: 'cancelled', at: new Date() });
    await order.save({ session });
    for (const item of order.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } }, { session });
    }
    await releaseCouponIfCheckoutVoid(order, session);
    return { order, returned: true };
  });
  if (!result) {
    if (!(await Order.exists({ _id: req.params.id, rider: req.user._id }))) throw notFound('That delivery');
    throw new AppError(422, 'INVALID_TRANSITION', 'Only an order out for delivery can be marked as missed.');
  }
  await claimUploads([url]);

  const { order, returned } = result;
  const link = `/orders/${order._id}`;
  await notify(
    returned
      ? [
          {
            user: order.user,
            type: 'order',
            title: `${label(order)} is going back to the shop`,
            body: `The rider couldn't reach you after ${MAX_ATTEMPTS} tries, so the order was cancelled.`,
            link,
          },
          {
            user: order.seller,
            type: 'order',
            title: `${label(order)} is coming back`,
            body: `The rider couldn't deliver it after ${MAX_ATTEMPTS} tries. It's cancelled and the stock is back.`,
            link,
          },
        ]
      : [
          {
            user: order.user,
            type: 'order',
            title: `We missed you: ${label(order)}`,
            body: 'The rider will try once more. Away for a while? Pick a day on the order page.',
            link,
          },
        ],
  );
  res.json({ order: riderCopy(order.toJSON()), returned });
}

// The buyer, after a miss, asks for the next try on a later day (or clears it to mean "any day").
export async function pickRetryDay(req, res) {
  const raw = req.body?.date;
  let retryOn = null;
  if (raw != null) {
    const picked = new Date(`${raw}T00:00:00`);
    const tomorrow = new Date(startOfDay(new Date()).getTime() + DAY_MS);
    const last = new Date(tomorrow.getTime() + (RETRY_WINDOW_DAYS - 1) * DAY_MS);
    if (typeof raw !== 'string' || Number.isNaN(picked.getTime()) || picked < tomorrow || picked > last) {
      throw invalid({ date: `Pick a day within the next ${RETRY_WINDOW_DAYS} days.` });
    }
    retryOn = picked;
  }
  // The order as it was, so the rider only hears about an actual change.
  const before = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: 'shipped', 'attempts.0': { $exists: true } },
    retryOn ? { retryOn } : { $unset: { retryOn: 1 } },
  );
  if (!before) {
    if (!(await Order.exists({ _id: req.params.id, user: req.user._id }))) throw notFound('That order');
    throw new AppError(409, 'NOT_RESCHEDULABLE', 'You can pick a day only after a missed delivery, before the rider heads out again.');
  }
  const was = before.retryOn?.getTime() ?? null;
  const order = before;
  order.retryOn = retryOn ?? undefined;
  if (was === (retryOn?.getTime() ?? null)) return res.json({ order });
  await notify([
    {
      user: order.rider,
      type: 'order',
      title: `${label(order)}: ${retryOn ? `try again on ${dayText(retryOn)}` : 'any day is fine now'}`,
      body: retryOn ? 'The buyer is away until then.' : 'The buyer cleared the day they picked.',
      link: '/deliveries',
    },
  ]);
  res.json({ order });
}

// The buyer says they were home for the last miss. Admins with the Orders area hear about it and see the rider's photo.
export async function disputeAttempt(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw notFound('That order');
  const last = order.attempts?.at(-1);
  if (!last) throw new AppError(409, 'NO_ATTEMPT', 'There is no missed delivery on this order.');
  if (last.disputedAt) return res.json({ order });
  last.disputedAt = new Date();
  await order.save();
  const admins = await adminsFor('orders');
  await notify(
    admins.map((user) => ({
      user,
      type: 'order',
      title: `${label(order)}: buyer says they were home`,
      body: "The rider marked a missed delivery. Compare the rider's photo with the buyer's address.",
      link: `/orders/${order._id}`,
    })),
  );
  res.json({ order });
}
