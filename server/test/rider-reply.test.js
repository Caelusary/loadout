import { describe, expect, it } from 'vitest';
import { Order, RiderFeedback } from '../src/models/index.js';
import { users } from '../src/seed/data.js';
import { signIn, useSeededDb } from './helpers.js';

useSeededDb();

const keyOf = (id) => Object.keys(users).find((k) => String(users[k]._id) === String(id));

describe("a rider's side of a report about them", () => {
  it('shows the rider why and when but not who or what was said, and takes one reply', async () => {
    const report = await RiderFeedback.findOne({ report: { $exists: true }, reviewedAt: null });
    const rider = await signIn(keyOf(report.rider));

    const profile = await rider.get('/api/rider/profile');
    const mine = profile.body.reports.find((r) => r._id === String(report._id));
    expect(mine).toMatchObject({ reason: report.report.reason, reply: null, reviewed: false });
    expect(JSON.stringify(profile.body.reports)).not.toContain(report.report.note);
    expect(mine.order).toBeUndefined();

    const other = await signIn(['ramon', 'joy', 'dante', 'rico'].find((k) => String(users[k]._id) !== String(report.rider)));
    expect((await other.post(`/api/rider/reports/${report._id}/reply`).send({ text: 'Not my delivery at all.' })).status).toBe(404);
    expect((await rider.post(`/api/rider/reports/${report._id}/reply`).send({ text: 'short' })).status).toBe(400);

    const sent = await rider.post(`/api/rider/reports/${report._id}/reply`).send({ text: 'I left it with the guard as asked.' });
    expect(sent.status).toBe(200);
    expect(sent.body.report.reply.text).toBe('I left it with the guard as asked.');
    expect((await rider.post(`/api/rider/reports/${report._id}/reply`).send({ text: 'Changing my story now.' })).status).toBe(409);

    const queue = await (await signIn('owner')).get('/api/admin/rider-feedback');
    expect(queue.body.items.find((f) => f._id === String(report._id)).riderReply.text).toBe('I left it with the guard as asked.');
  });
});

describe("a rider's side of a \"not received\" report", () => {
  it('reaches admins on the order but never the buyer or the shop', async () => {
    const order = await Order.findOneAndUpdate(
      { status: 'delivered', rider: { $ne: null }, deliveryIssue: { $exists: false } },
      { deliveryIssue: { reportedAt: new Date(), status: 'open', note: 'Never came' } },
      { new: true },
    );
    const rider = await signIn(keyOf(order.rider));
    const path = `/api/orders/${order._id}/delivery-issue/reply`;
    expect((await (await signIn(keyOf(order.user))).post(path).send({ text: 'Buyers cannot reply here.' })).status).toBe(403);
    expect((await rider.post(path).send({ text: 'Handed it to the buyer at the gate.' })).status).toBe(200);
    expect((await rider.post(path).send({ text: 'A second version of events.' })).status).toBe(409);

    const seen = async (key) => (await (await signIn(key)).get(`/api/orders/${order._id}`)).body.order.deliveryIssue;
    expect((await seen('owner')).riderReply.text).toBe('Handed it to the buyer at the gate.');
    expect((await seen(keyOf(order.user))).riderReply).toBeUndefined();
    expect((await seen(keyOf(order.seller))).riderReply).toBeUndefined();
  });
});
