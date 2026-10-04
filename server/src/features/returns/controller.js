import mongoose from 'mongoose';
import { Order, ReturnRequest, User } from '../../models/index.js';
import { RETURN_REASONS, RETURN_STATUSES, RETURN_WINDOW_DAYS } from '../../models/ReturnRequest.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { isId, pageParams, paginate, sameId } from '../../lib/request.js';
import { canManage } from '../../middleware/auth.js';
import { orderLabel, record } from '../activity/service.js';
import { notify } from '../notifications/service.js';
import {
  adminCanSettle,
  COUNTS_AGAINST_ORDER,
  refund,
  refundFor,
  returnWindowStart,
  statusAt,
  STUCK_DAYS,
  STUCK_MS,
  WINDOW_MS,
} from './service.js';

const SELLER_STATE = 'isActive role sellerProfile.status sellerProfile.shopName';

const note = (text, field, required) => {
  const value = typeof text === 'string' ? text.trim() : '';
  if (required && value.length < 5) throw invalid({ [field]: 'Give a reason of at least 5 characters.' });
  if (value.length > 500) throw invalid({ [field]: 'Keep it under 500 characters.' });
  return value || undefined;
};

const label = (ret) => `Return for ${orderLabel({ _id: ret.order })}`;
const notice = (user, title, body, ret) => ({ user, type: 'order', title, body, link: `/orders/${ret.order}` });

// Customer: ask to return some of a delivered order within 7 days of delivery.
export async function createReturn(req, res) {
  if (!isId(req.params.id)) throw notFound('That order');
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw notFound('That order');
  if (order.status !== 'delivered') throw new AppError(422, 'NOT_RETURNABLE', 'Only delivered orders can be returned.');
  if (Date.now() - returnWindowStart(order) > WINDOW_MS) {
    throw new AppError(422, 'NOT_RETURNABLE', `Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery.`);
  }

  const { reason, details, items } = req.body ?? {};
  if (!RETURN_REASONS.includes(reason)) {
    throw invalid({ reason: 'Returns are for damaged, wrong or not-as-described items.' });
  }
  if (!Array.isArray(items) || !items.length || items.length > order.items.length) {
    throw invalid({ items: 'Choose at least one item to return.' });
  }

  // Two requests for one order at once (a double-submit) would each see no earlier return and both be
  // created, so the same units could be refunded and restocked twice. Bumping the order's version inside
  // the transaction makes them conflict; the loser retries, sees the winner, and is refused.
  const ret = await mongoose.connection.transaction(async (session) => {
    await Order.updateOne({ _id: order._id }, { $inc: { __v: 1 } }, { session, timestamps: false });
    const earlier = await ReturnRequest.find({ order: order._id, status: { $in: COUNTS_AGAINST_ORDER } }).session(session);
    if (earlier.some((r) => ['requested', 'escalated'].includes(r.status))) {
      throw new AppError(409, 'CONFLICT', 'This order already has a return waiting for a decision.');
    }
    const alreadyReturned = new Map();
    for (const r of earlier) {
      for (const i of r.items) alreadyReturned.set(String(i.product), (alreadyReturned.get(String(i.product)) ?? 0) + i.qty);
    }

    const seen = new Set();
    const lines = items.map((entry) => {
      const { productId, qty } = entry ?? {};
      const line = order.items.find((i) => String(i.product) === String(productId));
      if (!line || seen.has(String(productId))) throw invalid({ items: 'Choose items from this order, each once.' });
      seen.add(String(productId));
      const left = line.qty - (alreadyReturned.get(String(productId)) ?? 0);
      if (!Number.isInteger(qty) || qty < 1 || qty > left) {
        throw invalid({ items: left ? `You can return up to ${left} of ${line.name}.` : `${line.name} is already being returned.` });
      }
      return { product: line.product, name: line.name, qty, refundCents: refundFor(order, line, qty) };
    });

    const [created] = await ReturnRequest.create(
      [
        {
          order: order._id,
          user: req.user._id,
          seller: order.seller,
          items: lines,
          reason,
          details,
          refundCents: lines.reduce((sum, l) => sum + l.refundCents, 0),
        },
      ],
      { session },
    );
    return created;
  });
  await notify(notice(order.seller, `Return requested for ${orderLabel(order)}`, `${ret.items.length} item(s): ${reason.replace(/-/g, ' ')}.`, ret));
  res.status(201).json({ return: ret });
}

// The returns on one order, for its customer, its seller, or an admin with the Orders area.
export async function orderReturns(req, res) {
  if (!isId(req.params.id)) throw notFound('That order');
  const order = await Order.findById(req.params.id, 'user seller');
  const admin = canManage(req.user, 'orders');
  const allowed = order && (sameId(order.user, req.user) || sameId(order.seller, req.user) || admin);
  if (!allowed) throw notFound('That order');
  const items = await ReturnRequest.find({ order: order._id }).sort({ createdAt: -1, _id: -1 });
  const seller = admin ? await User.findById(order.seller, SELLER_STATE) : null;
  res.json({ items: items.map((r) => ({ ...r.toJSON(), ...(admin && { adminCanSettle: adminCanSettle(r, seller) }) })) });
}

// Seller's returns, newest first; `status` narrows the list.
export async function soldReturns(req, res) {
  const filter = { seller: req.user._id };
  if (RETURN_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  res.json(await paginate(ReturnRequest, filter, pageParams(req.query), (q) => q.sort({ createdAt: -1, _id: -1 }).populate('user', 'name')));
}

// Admins see escalated returns by default: the ones waiting on them. `stuck` lists new or approved
// returns the shop hasn't moved for 3 days, or whose shop can no longer act.
export async function adminReturns(req, res) {
  let filter;
  if (req.query.status === 'stuck') {
    const cantAct = await User.find(
      { sellerProfile: { $exists: true }, $or: [{ isActive: false }, { 'sellerProfile.status': { $ne: 'approved' } }] },
      '_id',
    ).lean();
    filter = {
      status: { $in: ['requested', 'approved'] },
      $or: [{ updatedAt: { $lt: new Date(Date.now() - STUCK_MS) } }, { seller: { $in: cantAct.map((u) => u._id) } }],
    };
  } else {
    filter = { status: RETURN_STATUSES.includes(req.query.status) ? req.query.status : 'escalated' };
  }
  const page = await paginate(ReturnRequest, filter, pageParams(req.query), (q) =>
    q.sort({ createdAt: -1, _id: -1 }).populate('user', 'name').populate('seller', SELLER_STATE),
  );
  // A deleted shop comes back as null, which also counts as unable to act.
  res.json({ ...page, items: page.items.map((r) => ({ ...r.toJSON(), adminCanSettle: adminCanSettle(r, r.seller) })) });
}

// Moves a return from one status to the next, only if it's still where the caller expects it.
async function move(filter, from, to, by, noteText, session) {
  const ret = await ReturnRequest.findOneAndUpdate(
    { ...filter, status: from },
    { status: to, $push: { history: { status: to, by, ...(noteText && { note: noteText }), at: new Date() } } },
    { new: true, session },
  );
  return ret;
}

async function missing(filter, what) {
  if (!isId(filter._id) || !(await ReturnRequest.exists(filter))) throw notFound('That return');
  throw new AppError(422, 'INVALID_TRANSITION', what);
}

// Seller approves or declines (with a reason) a new request.
export async function sellerDecide(req, res) {
  const { decision } = req.body ?? {};
  if (!['approve', 'decline'].includes(decision)) throw invalid({ decision: 'Choose approve or decline.' });
  const text = note(req.body.note, 'note', decision === 'decline');
  const filter = { _id: req.params.id, seller: req.user._id };
  const ret = await move(filter, 'requested', decision === 'approve' ? 'approved' : 'declined', 'seller', text);
  if (!ret) await missing(filter, 'This return has already been decided.');
  await notify(
    notice(
      ret.user,
      decision === 'approve' ? 'Your return was approved' : 'Your return was declined',
      decision === 'approve'
        ? 'Send the item back to the shop. You are refunded when it arrives.'
        : `${text} You can ask an admin to review this within ${RETURN_WINDOW_DAYS} days.`,
      ret,
    ),
  );
  res.json({ return: ret });
}

// Customer asks an admin to review a declined return, within 7 days of the decline.
export async function escalate(req, res) {
  const text = note(req.body?.note, 'note', true);
  const filter = { _id: req.params.id, user: req.user._id };
  const current = isId(req.params.id) ? await ReturnRequest.findOne(filter) : null;
  if (!current) throw notFound('That return');
  const declinedAt = statusAt(current.history, 'declined');
  if (current.status === 'declined' && Date.now() - new Date(declinedAt).getTime() > WINDOW_MS) {
    throw new AppError(422, 'INVALID_TRANSITION', `A decline can be reviewed within ${RETURN_WINDOW_DAYS} days.`);
  }
  const ret = await move(filter, 'declined', 'escalated', 'customer', text);
  if (!ret) throw new AppError(422, 'INVALID_TRANSITION', 'Only a declined return can be sent to an admin.');
  await notify(notice(ret.seller, 'A declined return went to an admin', text, ret));
  res.json({ return: ret });
}

// What an admin (Orders area) may do, from which status. Escalated returns are theirs to settle;
// a stuck new request can be approved or declined in the shop's place; a stuck approved one can be
// refunded once the customer shows the item went back. All final and logged.
const ADMIN_MOVES = {
  approve: { from: ['escalated', 'requested'], to: 'approved', did: 'approved' },
  decline: { from: ['escalated', 'requested'], to: 'closed', did: 'turned down' },
  refund: { from: ['approved'], to: 'refunded', did: 'refunded' },
};

export async function adminDecide(req, res) {
  const { decision } = req.body ?? {};
  const how = ADMIN_MOVES[decision];
  if (!how) throw invalid({ decision: 'Choose approve, decline or refund.' });
  const text = note(req.body.note, 'note', true);
  if (!isId(req.params.id)) throw notFound('That return');
  const current = await ReturnRequest.findById(req.params.id).populate('seller', SELLER_STATE);
  if (!current) throw notFound('That return');
  if (!how.from.includes(current.status) || !adminCanSettle(current, current.seller)) {
    throw new AppError(
      422,
      'INVALID_TRANSITION',
      `Admins settle escalated returns, and new or approved ones the shop hasn't moved for ${STUCK_DAYS} days.`,
    );
  }
  const ret = await mongoose.connection.transaction(async (session) => {
    const moved = await move({ _id: current._id }, current.status, how.to, 'admin', text, session);
    if (!moved) return null;
    if (how.to === 'refunded') await refund(moved, session);
    await record(
      req.user,
      {
        action: 'return.decide',
        target: { kind: 'return', id: moved._id, label: label(moved) },
        summary: `${how.did} a ${current.status === 'escalated' ? 'disputed' : 'stuck'} return on ${orderLabel({ _id: moved.order })}`,
        undoable: false,
      },
      session,
    );
    return moved;
  });
  if (!ret) throw new AppError(409, 'CONFLICT', 'This return changed while you were deciding. Reload and try again.');
  const title = { approve: 'An admin approved the return', decline: 'An admin closed the return', refund: 'An admin recorded your refund' }[decision];
  await notify([notice(ret.user, title, text, ret), notice(ret.seller._id ?? ret.seller, title, text, ret)]);
  res.json({ return: ret });
}

// Seller confirms the items came back.
export async function markReceived(req, res) {
  const filter = { _id: req.params.id, seller: req.user._id };
  const ret = await mongoose.connection.transaction(async (session) => {
    const moved = await move(filter, 'approved', 'refunded', 'seller', undefined, session);
    if (!moved) return null;
    await refund(moved, session);
    return moved;
  });
  if (!ret) await missing(filter, 'Only an approved return can be marked as received.');
  await notify(notice(ret.user, 'Your refund is on its way', 'The shop received your return.', ret));
  res.json({ return: ret });
}
