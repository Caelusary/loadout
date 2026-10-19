import { returnWindowStart, WINDOW_MS } from '../returns/service.js';

// Simulated payment holding, the way Shopee's Guarantee works: Loadout keeps the buyer's money until the buyer says
// the order arrived (or 7 days after delivery pass with no report), and only then releases it to the shop. A shop
// that never ships, or ships an empty box, never gets paid. Payments are simulated, so this is worked out from the
// order rather than moving any money.
//
//   held      not delivered yet, waiting for the buyer, or a "not received" report is open
//   released  the buyer confirmed, a report was dismissed, or the 7 days passed
//   refunded  an admin upheld the buyer's report, so it goes back to them
//   none      cancelled before anyone paid out
export const shopShareCents = (order) =>
  Math.max(0, order.subtotalCents - (order.discountCents ?? 0) - (order.refundedCents ?? 0));

export function paymentState(order, now = Date.now()) {
  if (order.status === 'cancelled') return { state: 'none', amountCents: 0 };
  const amountCents = shopShareCents(order);
  if (order.status !== 'delivered') return { state: 'held', amountCents, until: 'delivery' };
  const issue = order.deliveryIssue?.status;
  if (issue === 'open') return { state: 'held', amountCents, until: 'report' };
  if (issue === 'resolved') return { state: 'refunded', amountCents };
  if (order.receivedAt) return { state: 'released', amountCents, releasedAt: order.receivedAt };
  const releaseAt = returnWindowStart(order) + WINDOW_MS;
  if (issue === 'dismissed' || now >= releaseAt) return { state: 'released', amountCents, releasedAt: new Date(Math.min(now, releaseAt)) };
  return { state: 'held', amountCents, until: 'buyer', releaseAt: new Date(releaseAt) };
}
