import { Order } from '../../models/index.js';
import { ON_THE_WAY, RIDER_STEPS, TRANSITIONS } from '../../models/Order.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { pageParams, paginate } from '../../lib/request.js';
import { notify, orderNotices } from '../notifications/service.js';

const SELLER_FIELDS = 'sellerProfile.shopName sellerProfile.slug';

// A rider's orders: the ones still to deliver (oldest hand-over first, the way a route is run),
// or the ones already done (newest first).
export async function myDeliveries(req, res) {
  const done = req.query.view === 'done';
  const filter = { rider: req.user._id, status: done ? { $in: ['delivered', 'cancelled'] } : { $in: ON_THE_WAY } };
  const sort = done ? { updatedAt: -1, _id: -1 } : { createdAt: 1, _id: 1 };
  res.json(
    await paginate(Order, filter, pageParams(req.query), (q) =>
      q.sort(sort).populate('user', 'name').populate('seller', SELLER_FIELDS),
    ),
  );
}

// The rider takes an order out for delivery, then marks it delivered (which starts the return window).
export async function advanceDelivery(req, res) {
  const next = req.body?.status;
  if (!RIDER_STEPS.includes(next)) {
    throw new AppError(422, 'INVALID_TRANSITION', 'Riders mark orders out for delivery or delivered.');
  }
  const allowedFrom = Object.keys(TRANSITIONS).filter((from) => TRANSITIONS[from].includes(next));
  // The status condition makes this safe against a concurrent cancel or the 7-day auto-complete.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, rider: req.user._id, status: { $in: allowedFrom } },
    {
      status: next,
      ...(next === 'delivered' && { deliveredBy: 'rider' }),
      $push: { statusHistory: { status: next, at: new Date() } },
    },
    { new: true },
  );
  if (!order) {
    if (!(await Order.exists({ _id: req.params.id, rider: req.user._id }))) throw notFound('That delivery');
    throw new AppError(422, 'INVALID_TRANSITION', `This order can't move to ${next} from its current status.`);
  }
  await notify([orderNotices.toCustomer(order), ...(next === 'delivered' ? [orderNotices.deliveredForSeller(order)] : [])]);
  res.json({ order });
}
