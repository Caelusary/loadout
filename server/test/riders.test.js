import { beforeEach, describe, expect, it } from 'vitest';
import { Notification, Order, RiderFeedback, User } from '../src/models/index.js';
import { pickRider, smoothedRating } from '../src/features/riders/service.js';
import { users } from '../src/seed/data.js';
import { address, productId, signIn, useSeededDb, riderStep } from './helpers.js';

useSeededDb();

// Tests pause riders; each starts from the seeded state, where only Rico is paused.
beforeEach(async () => {
  await User.updateMany(
    { role: 'rider', _id: { $ne: users.rico._id } },
    { $unset: { 'riderProfile.heldAt': 1, 'riderProfile.heldReason': 1 } },
  );
});

const id = (key) => String(users[key]._id);
const keyOf = (riderId) => Object.keys(users).find((k) => id(k) === String(riderId));
const GLIDE_PRODUCT = 12;

// A fresh Glide order from Mika, handed to a rider (shipped), optionally taken further by that rider.
async function shippedOrder(buyerKey = 'mika') {
  const buyer = await signIn(buyerKey);
  const placed = await buyer
    .post('/api/orders')
    .send({
      items: [{ productId: productId(GLIDE_PRODUCT), qty: 1 }],
      shippingAddress: address,
      paymentMethod: 'cod',
    });
  const order = placed.body.orders[0];
  const shop = await signIn('glide');
  for (const status of ['processing', 'shipped'])
    await shop.patch(`/api/orders/${order._id}/status`).send({ status });
  const { rider } = await Order.findById(order._id).lean();
  return { order, buyer, shop, riderKey: keyOf(rider), rider: await signIn(keyOf(rider)) };
}

async function deliveredAndReceived() {
  const o = await shippedOrder();
  for (const status of ['out-for-delivery', 'delivered'])
    await riderStep(o.rider, o.order._id, status);
  await o.buyer.patch(`/api/orders/${o.order._id}/received`);
  return o;
}

describe('dispatch', () => {
  it('weighs rating against workload, and skips riders on hold', async () => {
    // New riders start at 4 stars; one bad rating barely moves them, five do.
    expect(smoothedRating()).toBe(4);
    expect(smoothedRating({ sum: 1, count: 1 })).toBeCloseTo(3.73, 2);
    expect(smoothedRating({ sum: 12, count: 5 })).toBeCloseTo(3.47, 2);

    const picked = String(await pickRider());
    expect(picked).not.toBe(id('rico')); // Rico is paused after a report
    await User.updateOne({ _id: picked }, { 'riderProfile.heldAt': new Date() });
    expect(String(await pickRider())).not.toBe(picked);
  });
});

describe('declining', () => {
  it('passes the order to someone else, never back, and only before pickup', async () => {
    const { order, riderKey, rider } = await shippedOrder();
    const missing = await rider.post(`/api/deliveries/${order._id}/decline`).send({});
    expect(missing.status).toBe(400);
    const declined = await rider.post(`/api/deliveries/${order._id}/decline`).send({ reason: 'too-far' });
    expect(declined.status).toBe(200);
    const after = await Order.findById(order._id).lean();
    expect(String(after.rider)).not.toBe(id(riderKey));
    expect(String(after.declines[0].rider)).toBe(id(riderKey));
    expect(await Notification.exists({ user: after.rider, title: /New delivery/ })).toBeTruthy();
    // The decliner can't see or touch it any more.
    expect((await rider.get(`/api/orders/${order._id}`)).status).toBe(404);

    const second = await signIn(keyOf(after.rider));
    await second.patch(`/api/deliveries/${order._id}`).send({ status: 'out-for-delivery' });
    const late = await second.post(`/api/deliveries/${order._id}/decline`).send({ reason: 'unavailable' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ALREADY_PICKED_UP');
  });

  it('waits unassigned when nobody else is free, and tells the shop', async () => {
    await User.updateMany(
      { role: 'rider', _id: { $ne: users.joy._id } },
      { 'riderProfile.heldAt': new Date() },
    );
    const { order, rider, riderKey } = await shippedOrder();
    expect(riderKey).toBe('joy');
    await rider.post(`/api/deliveries/${order._id}/decline`).send({ reason: 'other', note: 'Flat tyre' });
    const after = await Order.findById(order._id).lean();
    expect(after.rider).toBeUndefined();
    expect(await Notification.exists({ user: users.glide._id, title: /waiting for a rider/ })).toBeTruthy();
  });
});

describe('rating and reporting a rider', () => {
  it('lets the buyer rate once, after saying it arrived', async () => {
    const early = await shippedOrder();
    const tooSoon = await early.buyer.post(`/api/orders/${early.order._id}/rider-rating`).send({ stars: 5 });
    expect(tooSoon.status).toBe(409);

    const { order, buyer, rider, riderKey } = await deliveredAndReceived();
    expect((await buyer.post(`/api/orders/${order._id}/rider-rating`).send({ stars: 9 })).status).toBe(400);
    const rated = await buyer
      .post(`/api/orders/${order._id}/rider-rating`)
      .send({ stars: 2, comment: 'Rude at the door' });
    expect(rated.status).toBe(201);
    expect((await buyer.post(`/api/orders/${order._id}/rider-rating`).send({ stars: 5 })).status).toBe(409);
    expect((await RiderFeedback.findOne({ order: order._id })).flagged).toBe(true);
    // Someone else's order can't be rated, and the rider sees the count, not who said it.
    expect(
      (await (await signIn('lea')).post(`/api/orders/${order._id}/rider-rating`).send({ stars: 1 })).status,
    ).toBe(404);
    const profile = await rider.get('/api/rider/profile');
    expect(profile.body.stats.ratingCount).toBeGreaterThan(0);
    expect(JSON.stringify(profile.body)).not.toContain('Rude at the door');
    expect(riderKey).toBeTruthy();
  });

  it('pauses a reported rider at once and moves their waiting orders to others', async () => {
    const { order, buyer, riderKey } = await shippedOrder();
    const second = await shippedOrder('lea');
    const reportedId = id(riderKey);
    const report = await buyer
      .post(`/api/orders/${order._id}/rider-report`)
      .send({ reason: 'harassment', note: 'Kept texting me' });
    expect(report.status).toBe(201);
    const rider = await User.findById(reportedId).lean();
    expect(rider.riderProfile.heldAt).toBeTruthy();
    expect(String(await pickRider())).not.toBe(reportedId);
    // Their orders not yet picked up went to someone else.
    for (const o of [order, second.order]) {
      const now = await Order.findById(o._id).lean();
      if (now.rider) expect(String(now.rider)).not.toBe(reportedId);
    }
    expect(await Notification.exists({ user: users.owner._id, title: /reported/ })).toBeTruthy();
    // The order went to a new rider, so the buyer's page starts fresh for them; the report stays with the old one.
    const page = (await buyer.get(`/api/orders/${order._id}`)).body.order;
    if (page.rider) {
      expect(page.riderFeedback).toMatchObject({ reported: false, canReport: true });
    }
    expect(await RiderFeedback.countDocuments({ order: order._id, rider: reportedId, report: { $exists: true } })).toBe(1);
  });

  it('shows the buyer a first name, vehicle and plate while on the way, and never the phone', async () => {
    const { order, buyer, shop } = await shippedOrder();
    const seen = (await buyer.get(`/api/orders/${order._id}`)).body.order.rider;
    expect(seen.name.split(' ')).toHaveLength(1);
    expect(seen.riderProfile.vehicle).toBeTruthy();
    expect(JSON.stringify(seen)).not.toMatch(/09\d{9}/);
    expect((await shop.get(`/api/orders/${order._id}`)).body.order.declines).toBeUndefined();
  });
});

describe('admin riders page', () => {
  it('needs the users area, shows the queue, and clears a hold with a note', async () => {
    expect((await (await signIn('mika')).get(`/api/admin/riders/${id('dante')}`)).status).toBe(403);
    const owner = await signIn('owner');
    const dante = await owner.get(`/api/admin/riders/${id('dante')}`);
    expect(dante.status).toBe(200);
    expect(dante.body.stats).toMatchObject({ ratingAvg: 2.4, ratingCount: 5 });

    const queue = await owner.get('/api/admin/rider-feedback');
    const report = queue.body.items.find((f) => f.report);
    expect(report.rider.name).toBe('Rico Mendoza');
    expect(
      (await owner.patch(`/api/admin/rider-feedback/${report._id}`).send({ note: 'Called the buyer' }))
        .status,
    ).toBe(200);
    expect((await owner.get('/api/admin/rider-feedback')).body.items.some((f) => f._id === report._id)).toBe(
      false,
    );

    expect((await owner.patch(`/api/admin/riders/${id('rico')}/hold`).send({ action: 'clear' })).status).toBe(
      400,
    );
    const cleared = await owner
      .patch(`/api/admin/riders/${id('rico')}/hold`)
      .send({ action: 'clear', note: 'Spoke to both sides' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.rider.riderProfile.heldAt).toBeUndefined();

    const detail = await owner.get(`/api/admin/riders/${id('dante')}`);
    expect(detail.body.feedback).toHaveLength(5);
  });

  it('lets a rider keep their own details', async () => {
    const joy = await signIn('joy');
    const bad = await joy.patch('/api/rider/profile').send({ plate: '!!' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.plate).toBeTruthy();
    // Changing the vehicle goes through an admin (vehicle-change.test.js); the phone is hers to change.
    const ok = await joy.patch('/api/rider/profile').send({ phone: '09171112222' });
    expect(ok.body.profile.phone).toBe('09171112222');
    expect((await (await signIn('mika')).get('/api/rider/profile')).status).toBe(403);
  });
});
