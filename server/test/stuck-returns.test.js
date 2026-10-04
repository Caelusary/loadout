import { describe, expect, it } from 'vitest';
import { ActivityLog, Order, Product, ReturnRequest } from '../src/models/index.js';
import { users } from '../src/seed/data.js';
import { signIn, useSeededDb } from './helpers.js';

useSeededDb();

const DAY_MS = 24 * 60 * 60 * 1000;
const id = (key) => users[key]._id.toString();

// Lea's order from Glide delivered about a day ago (seed), so a return is within its window.
async function askForReturn() {
  const lea = await signIn('lea');
  const order = await Order.findOne({ user: id('lea'), seller: id('glide'), status: 'delivered' }).sort({ createdAt: -1 });
  const res = await lea.post(`/api/orders/${order._id}/returns`).send({
    reason: 'damaged',
    details: 'The scroll wheel squeaks and skips.',
    items: [{ productId: String(order.items[0].product), qty: 1 }],
  });
  expect(res.status).toBe(201);
  return { rid: res.body.return._id, order };
}
const age = (rid, days) => {
  const at = new Date(Date.now() - days * DAY_MS);
  return ReturnRequest.updateOne({ _id: rid }, { $set: { 'history.$[].at': at, updatedAt: at } }, { timestamps: false });
};

describe('returns a shop sits on', () => {
  it('lets an admin decide a request the shop has not touched for 3 days, and refund an approved one', async () => {
    const admin = await signIn('admin');
    const { rid, order } = await askForReturn();
    const decide = (decision) => admin.patch(`/api/admin/returns/${rid}`).send({ decision, note: 'Shop did not respond.' });

    expect((await decide('approve')).status).toBe(422); // too soon: the shop still has time
    await age(rid, 4);
    expect((await admin.get('/api/admin/returns?status=stuck')).body.items.map((r) => r._id)).toContain(rid);
    expect((await decide('approve')).body.return.status).toBe('approved');

    expect((await decide('refund')).status).toBe(422); // just approved: the shop gets its 3 days again
    await age(rid, 4);
    const stock = (await Product.findById(order.items[0].product)).stock;
    const refunded = await decide('refund');
    expect(refunded.body.return.status).toBe('refunded');
    expect((await Product.findById(order.items[0].product)).stock).toBe(stock + 1);
    expect((await Order.findById(order._id)).refundedCents).toBe(refunded.body.return.refundCents);
    expect(await ActivityLog.countDocuments({ action: 'return.decide' })).toBe(2);
  });

  it("lets an admin step in at once when the shop can't act", async () => {
    const admin = await signIn('admin');
    await ReturnRequest.deleteMany({}); // the order's one unit was returned in the test above
    const { rid } = await askForReturn();
    await admin.patch(`/api/admin/sellers/${id('glide')}`).send({ status: 'suspended' });
    const list = await admin.get(`/api/orders/${(await ReturnRequest.findById(rid)).order}/returns`);
    expect(list.body.items.find((r) => r._id === rid).adminCanSettle).toBe(true);
    const res = await admin.patch(`/api/admin/returns/${rid}`).send({ decision: 'approve', note: 'The shop is suspended.' });
    expect(res.body.return.status).toBe('approved');
  });
});
