import mongoose from 'mongoose';
import { Order, User } from '../../models/index.js';
import { RETURN_WINDOW_DAYS } from '../../models/ReturnRequest.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';
import { canManage } from '../../middleware/auth.js';
import { orderLabel, record } from '../activity/service.js';
import { notify } from '../notifications/service.js';
import { returnWindowStart, WINDOW_MS } from '../returns/service.js';

// "Did it arrive?" The rider marks an order delivered, but only the customer can say whether it did. Answering is
// never required: a delivered order nobody answers for counts as received once the return window has passed.
// A "not received" report is for an admin to settle, the same way a declined return is escalated.

const MAX_NOTE = 300;

export const windowOpen = (order, now = Date.now()) => now - returnWindowStart(order) <= WINDOW_MS;

async function ownDeliveredOrder(req) {
  const order = isId(req.params.id) ? await Order.findOne({ _id: req.params.id, user: req.user._id }) : null;
  if (!order) throw notFound('That order');
  if (order.status !== 'delivered') throw new AppError(409, 'NOT_DELIVERED', "This order hasn't been delivered yet.");
  return order;
}

const changed = () => new AppError(409, 'CONFLICT', 'This order changed while you were answering. Reload and try again.');

export async function confirmReceived(req, res) {
  const order = await ownDeliveredOrder(req);
  if (order.deliveryIssue) throw new AppError(409, 'ISSUE_REPORTED', 'You already reported a problem with this delivery.');
  if (order.receivedAt) return res.json({ order });
  // Conditional, so a confirm and a report sent at the same moment can't both land.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, receivedAt: { $exists: false }, deliveryIssue: { $exists: false } },
    { receivedAt: new Date() },
    { new: true },
  );
  if (!updated) throw changed();
  res.json({ order: updated });
}

export async function reportNotReceived(req, res) {
  const order = await ownDeliveredOrder(req);
  if (order.receivedAt) {
    throw new AppError(409, 'ALREADY_RECEIVED', 'You already confirmed this order arrived. If something is wrong with it, ask for a return.');
  }
  if (order.deliveryIssue) throw new AppError(409, 'ISSUE_REPORTED', 'You already reported this delivery.');
  if (!windowOpen(order)) {
    throw new AppError(409, 'WINDOW_PASSED', `The ${RETURN_WINDOW_DAYS} days to report a missing delivery are over.`);
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length > MAX_NOTE) throw invalid({ note: `Keep the note under ${MAX_NOTE} characters` });

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, receivedAt: { $exists: false }, deliveryIssue: { $exists: false } },
    { deliveryIssue: { reportedAt: new Date(), status: 'open', ...(note && { note }) } },
    { new: true, runValidators: true },
  );
  if (!updated) throw changed();

  const admins = (await User.find({ role: 'admin', isActive: true })).filter((a) => canManage(a, 'orders'));
  const link = `/orders/${updated._id}`;
  const heard = (user, body) => ({ user, type: 'order', title: `${orderLabel(updated)} was reported as not received`, body, link });
  await notify([
    ...admins.map((a) => heard(a._id, 'The buyer says it never arrived. Open it to settle the report.')),
    heard(updated.seller, 'The buyer says it never arrived. An admin will look into it.'),
    ...(updated.rider ? [heard(updated.rider, 'The buyer says it never arrived. An admin will look into it.')] : []),
  ]);
  res.json({ order: updated });
}

// An admin with the Orders area closes the report with a note everyone involved can read. "Resolve" means the buyer
// was right and it has been dealt with; "dismiss" means the report wasn't upheld. Either way it's logged, and final.
export async function settleDeliveryIssue(req, res) {
  const { decision, note } = req.body ?? {};
  const text = typeof note === 'string' ? note.trim() : '';
  const fields = {};
  if (!['resolve', 'dismiss'].includes(decision)) fields.decision = 'Choose resolve or dismiss';
  if (text.length < 3) fields.note = 'Add a short note explaining your decision';
  else if (text.length > MAX_NOTE) fields.note = `Keep the note under ${MAX_NOTE} characters`;
  if (Object.keys(fields).length) throw invalid(fields);
  if (!isId(req.params.id)) throw notFound('That order');

  const status = decision === 'resolve' ? 'resolved' : 'dismissed';
  let settled;
  await mongoose.connection.transaction(async (session) => {
    settled = await Order.findOneAndUpdate(
      { _id: req.params.id, 'deliveryIssue.status': 'open' },
      { 'deliveryIssue.status': status, 'deliveryIssue.resolvedAt': new Date(), 'deliveryIssue.resolution': text },
      { new: true, session },
    );
    if (!settled) return;
    await record(
      req.user,
      {
        action: 'order.delivery-issue',
        target: { kind: 'order', id: settled._id, label: orderLabel(settled) },
        summary: `${status} the delivery report on ${orderLabel(settled)}`,
        undoable: false,
      },
      session,
    );
  });
  if (!settled) throw new AppError(409, 'CONFLICT', 'There is no open delivery report on this order.');

  const link = `/orders/${settled._id}`;
  const told = (user) => ({ user, type: 'order', title: `Delivery report on ${orderLabel(settled)} was ${status}`, body: text, link });
  await notify([told(settled.user), told(settled.seller), ...(settled.rider ? [told(settled.rider)] : [])]);
  res.json({ order: settled });
}

// Delivered orders still waiting for an answer, for the "did it arrive?" prompt. Newest first.
export async function awaitingReceipt(userId, now = Date.now()) {
  const delivered = await Order.find({
    user: userId,
    status: 'delivered',
    receivedAt: { $exists: false },
    deliveryIssue: { $exists: false },
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(20)
    .populate('seller', 'sellerProfile.shopName')
    .populate('rider', 'name');
  // The rider by first name only, as on the order page, so the prompt can ask how they did.
  return delivered
    .filter((o) => windowOpen(o, now))
    .slice(0, 5)
    .map((o) => {
      const order = o.toJSON();
      if (order.rider) order.rider = { _id: order.rider._id, name: order.rider.name.split(' ')[0] };
      return order;
    });
}
