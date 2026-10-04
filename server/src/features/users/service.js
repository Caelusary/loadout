import { Order, ReturnRequest } from '../../models/index.js';
import { AppError } from '../../lib/AppError.js';
import { cancelOrders, OPEN_STATUSES, UNSHIPPED } from '../orders/service.js';

// A declined seller applicant may apply again this long after the decision.
export const REAPPLY_WAIT_MS = 7 * 24 * 60 * 60 * 1000;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// An account's open orders as a customer and as a shop. Unshipped ones can be cancelled when the
// account closes; shipped ones are already with the courier, so closing waits until they arrive.
export async function openOrders(userId) {
  const either = { $or: [{ user: userId }, { seller: userId }] };
  const [open, returns] = await Promise.all([
    Order.find({ ...either, status: { $in: OPEN_STATUSES } }, 'status'),
    ReturnRequest.countDocuments({ ...either, status: { $in: RETURNS_IN_PROGRESS } }),
  ]);
  return {
    unshipped: open.filter((o) => UNSHIPPED.includes(o.status)).length,
    shipped: open.filter((o) => o.status === 'shipped').length,
    returns,
  };
}

// A return still waiting on someone: closing either side's account would strand the refund.
const RETURNS_IN_PROGRESS = ['requested', 'approved', 'escalated'];

// Checked again inside the closing transaction, so an order placed after the first check can't
// be left open against an account that no longer exists.
export async function assertNothingOpen(userId, session) {
  const still = await Order.exists({ $or: [{ user: userId }, { seller: userId }], status: { $in: OPEN_STATUSES } }).session(session);
  if (still) throw new AppError(409, 'OPEN_ORDERS', 'A new order came in. Review it and try again.');
}

// Before an account closes: refuse while anything has shipped, and ask before cancelling the rest.
export function assertCanClose({ unshipped, shipped, returns }, cancelling, whose) {
  if (returns) {
    throw new AppError(409, 'RETURNS_OPEN', `${whose} ${plural(returns, 'return')} in progress. Settle ${returns === 1 ? 'it' : 'them'} first.`);
  }
  if (shipped) {
    throw new AppError(409, 'ORDERS_SHIPPED', `${whose} ${plural(shipped, 'shipped order')} on the way. Wait until they arrive.`);
  }
  if (unshipped && !cancelling) {
    throw new AppError(409, 'OPEN_ORDERS', `${whose} ${plural(unshipped, 'unshipped order')}. Cancel them to continue.`);
  }
}

// Orders placed by the account are cancelled as the customer's, orders to its shop as the seller's.
export async function cancelClosedAccountOrders(userId, session, { self = false } = {}) {
  const reason = self ? 'The account was closed.' : 'An admin closed the account.';
  return [
    ...(await cancelOrders({ user: userId }, { by: self ? 'customer' : 'admin', reason }, session)),
    ...(await cancelOrders({ seller: userId }, { by: self ? 'seller' : 'admin', reason }, session)),
  ];
}
