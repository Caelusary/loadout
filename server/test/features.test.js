import { describe, expect, it } from 'vitest';
import { Coupon, Notification, Product } from '../src/models/index.js';
import { users } from '../src/seed/data.js';
import { allocate } from '../src/features/coupons/service.js';
import { address, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

const checkout = (agent, items, extra = {}) =>
  agent.post('/api/orders').send({ items, shippingAddress: address, paymentMethod: 'cod', ...extra });

describe('discount codes', () => {
  it('prices the discount on the server and splits it across shops', async () => {
    const lea = await signIn('lea');
    const items = [
      { productId: productId(2), qty: 1 }, // ₱4,850 from one shop
      { productId: productId(12), qty: 1 }, // ₱1,490 from another
    ];

    const preview = await lea.post('/api/coupons/preview').send({ code: 'loadout10', items });
    expect(preview.status).toBe(200);
    expect(preview.body.discountCents).toBe(63400);

    const res = await checkout(lea, items, { couponCode: 'loadout10', discountCents: 999999 });
    expect(res.status).toBe(201);
    const discounts = res.body.orders.map((o) => o.discountCents);
    expect(discounts.reduce((a, b) => a + b, 0)).toBe(63400);
    const kbOrder = res.body.orders.find((o) => o.items[0].product === productId(2));
    expect(kbOrder.discountCents).toBe(48500);
    expect(kbOrder.totalCents).toBe(485000 - 48500);
    expect(kbOrder.couponCode).toBe('LOADOUT10');
  });

  it('allows one use per customer and rolls back the checkout when a code is rejected', async () => {
    const lea = await signIn('lea');
    const item = { productId: productId(2), qty: 1 };
    const before = await Product.findById(item.productId).lean();

    const again = await checkout(lea, [item], { couponCode: 'LOADOUT10' });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('COUPON_INVALID');
    expect((await Product.findById(item.productId).lean()).stock).toBe(before.stock);
    expect((await Coupon.findOne({ code: 'LOADOUT10' })).usedCount).toBe(1);
  });

  it('rejects expired codes and subtotals under the minimum', async () => {
    const paolo = await signIn('paolo');
    const cheap = [{ productId: productId(16), qty: 1 }]; // ₱690

    const expired = await paolo.post('/api/coupons/preview').send({ code: 'LAUNCH25', items: cheap });
    expect(expired.status).toBe(422);
    const tooSmall = await paolo.post('/api/coupons/preview').send({ code: 'WELCOME200', items: cheap });
    expect(tooSmall.status).toBe(422);
    expect(tooSmall.body.error.fields.couponCode).toMatch(/at least/);
  });

  it("previews only carts that checkout would accept", async () => {
    const glide = await signIn('glide');
    // A seller's own product, an unlisted one, and more than is in stock are all refused, as at checkout.
    const own = await glide.post('/api/coupons/preview').send({ code: 'LOADOUT10', items: [{ productId: productId(12), qty: 1 }] });
    expect(own.status).toBe(422);
    expect(own.body.error.code).toBe('OWN_PRODUCT');

    await Product.updateOne({ _id: productId(2) }, { isActive: false });
    const unlisted = await glide.post('/api/coupons/preview').send({ code: 'LOADOUT10', items: [{ productId: productId(2), qty: 1 }] });
    expect(unlisted.status).toBe(409);
    expect(unlisted.body.error.code).toBe('UNAVAILABLE');

    const tooMany = await glide.post('/api/coupons/preview').send({ code: 'LOADOUT10', items: [{ productId: productId(22), qty: 3 }] });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('OUT_OF_STOCK');
  });
});

describe('discount code edge cases', () => {
  it('splits a discount so parts add up and no shop gets more than its own subtotal', () => {
    // A near-total discount across three shops: the old last-takes-remainder split overshot the last shop.
    const subtotals = [100000, 100000, 300001];
    const shares = allocate(500000, subtotals);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(500000);
    shares.forEach((share, i) => expect(share).toBeLessThanOrEqual(subtotals[i]));
    expect(allocate(0, subtotals)).toEqual([0, 0, 0]);
    expect(allocate(500001, subtotals)).toEqual(subtotals);
  });

  it('lets only one of two simultaneous checkouts take the last use', async () => {
    await Coupon.create({ code: 'ONEUSE1', type: 'fixed', value: 5000, maxUses: 1 });
    const [mika, lea] = await Promise.all([signIn('mika'), signIn('lea')]);
    const item = { productId: productId(15), qty: 1 };
    const before = (await Product.findById(item.productId).lean()).stock;

    const results = await Promise.all([mika, lea].map((agent) => checkout(agent, [item], { couponCode: 'ONEUSE1' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(results.find((r) => r.status === 422).body.error.code).toBe('COUPON_INVALID');
    const coupon = await Coupon.findOne({ code: 'ONEUSE1' });
    expect(coupon.usedCount).toBe(1);
    expect(coupon.usedBy).toHaveLength(1);
    // Only the winning checkout reserved stock.
    expect((await Product.findById(item.productId).lean()).stock).toBe(before - 1);

    const coil = await signIn('coilworks');
    const late = await coil.post('/api/coupons/preview').send({ code: 'ONEUSE1', items: [item] });
    expect(late.status).toBe(422);
    expect(late.body.error.message).toMatch(/used up/);
  });

  it('gives the use back only once every order from the checkout is cancelled', async () => {
    await Coupon.create({ code: 'CANCELME', type: 'fixed', value: 10000, maxUses: 5 });
    const paolo = await signIn('paolo');
    const items = [
      { productId: productId(7), qty: 1 }, // one shop
      { productId: productId(16), qty: 1 }, // another shop
    ];
    const placed = await checkout(paolo, items, { couponCode: 'CANCELME' });
    expect(placed.status).toBe(201);
    const [first, second] = placed.body.orders;

    expect((await paolo.patch(`/api/orders/${first._id}/cancel`)).status).toBe(200);
    let coupon = await Coupon.findOne({ code: 'CANCELME' });
    expect(coupon.usedCount).toBe(1); // the other order still carries its share of the discount

    expect((await paolo.patch(`/api/orders/${second._id}/cancel`)).status).toBe(200);
    coupon = await Coupon.findOne({ code: 'CANCELME' });
    expect(coupon.usedCount).toBe(0);
    expect(coupon.usedBy).toHaveLength(0);

    const again = await paolo.post('/api/coupons/preview').send({ code: 'CANCELME', items });
    expect(again.status).toBe(200);
  });
});

describe('order timeline and notifications', () => {
  it('records each status change and tells the other side', async () => {
    const mika = await signIn('mika');
    const placed = await checkout(mika, [{ productId: productId(13), qty: 1 }]);
    expect(placed.status).toBe(201);
    const order = placed.body.orders[0];
    expect(order.statusHistory.map((s) => s.status)).toEqual(['placed']);
    expect(await Notification.exists({ user: order.seller, title: /New order/ })).toBeTruthy();

    const glide = await signIn('glide');
    const moved = await glide.patch(`/api/orders/${order._id}/status`).send({ status: 'processing' });
    expect(moved.status).toBe(200);
    expect(moved.body.order.statusHistory.map((s) => s.status)).toEqual(['placed', 'processing']);

    const inbox = await mika.get('/api/notifications');
    expect(inbox.body.items.some((n) => n.link === `/orders/${order._id}` && /being prepared/.test(n.title))).toBe(true);
    expect(inbox.body.unread).toBeGreaterThan(0);
    await mika.patch('/api/notifications/read-all');
    expect((await mika.get('/api/notifications')).body.unread).toBe(0);
  });

  it("keeps each user's notifications private", async () => {
    const mine = await Notification.findOne({ user: users.mika._id });
    const paolo = await signIn('paolo');
    const res = await paolo.patch(`/api/notifications/${mine._id}/read`);
    expect(res.status).toBe(404);
    expect((await Notification.findById(mine._id)).readAt ?? null).toEqual(mine.readAt ?? null);

    const inbox = await paolo.get('/api/notifications');
    expect(inbox.status).toBe(200);
    expect(inbox.body.items.every((n) => n.user === users.paolo._id.toString())).toBe(true);
  });
});

describe('wishlist', () => {
  it('adds idempotently, removes, and hides unlisted products', async () => {
    const paolo = await signIn('paolo');
    const id = productId(5);
    await paolo.put(`/api/wishlist/${id}`);
    const twice = await paolo.put(`/api/wishlist/${id}`);
    expect(twice.body.ids.filter((x) => x === id)).toHaveLength(1);
    expect((await paolo.get('/api/wishlist')).body.items.map((p) => p._id)).toContain(id);

    await Product.updateOne({ _id: id }, { isActive: false });
    expect((await paolo.get('/api/wishlist')).body.items.map((p) => p._id)).not.toContain(id);
    await Product.updateOne({ _id: id }, { isActive: true });

    const removed = await paolo.delete(`/api/wishlist/${id}`);
    expect(removed.body.ids).not.toContain(id);
  });

  it('is not available to admins', async () => {
    const admin = await signIn('admin');
    expect((await admin.get('/api/wishlist')).status).toBe(403);
  });
});
