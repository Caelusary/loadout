import { describe, expect, it } from 'vitest';
import { Coupon, Order, Product, ReturnRequest } from '../src/models/index.js';
import { autoCompleteShipped } from '../src/features/orders/service.js';
import { checkouts, products, users } from '../src/seed/data.js';
import { address, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

const id = (key) => users[key]._id.toString();
const DAY_MS = 24 * 60 * 60 * 1000;
const sellerKeyOf = (n) => Object.keys(users).find((k) => id(k) === String(products[n - 1].seller));
const stock = async (n) => (await Product.findById(productId(n))).stock;

// A fresh order for `customer` of product n, delivered just now, with an odd discount so refund rounding matters.
async function deliveredOrder(customer, n, qty, discountCents) {
  const p = await Product.findById(productId(n));
  return Order.create({
    user: id(customer),
    seller: p.seller,
    checkoutId: `qa-${n}-${Date.now()}-${Math.random()}`,
    items: [{ product: p._id, name: p.name, priceCents: p.priceCents, qty, image: p.images[0]?.url }],
    shippingAddress: address,
    shippingCents: 0,
    discountCents,
    paymentMethod: 'cod',
    status: 'delivered',
    statusHistory: [{ status: 'placed' }, { status: 'delivered', at: new Date() }],
  });
}

const ask = (order, qty, extra = {}) => ({
  reason: 'damaged',
  details: 'Arrived with a cracked shell.',
  items: [{ productId: String(order.items[0].product), qty }],
  ...extra,
});

describe('qa: return requests', () => {
  it('creates only one return when the same request is submitted twice at once', async () => {
    const mika = await signIn('mika');
    const order = await deliveredOrder('mika', 1, 3, 1001);
    const [a, b] = await Promise.all([
      mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 3)),
      mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 3)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await ReturnRequest.countDocuments({ order: order._id })).toBe(1);
  });

  it('never refunds more than was paid across several partial returns of one discounted line', async () => {
    const mika = await signIn('mika');
    const seller = await signIn(sellerKeyOf(1));
    const order = await deliveredOrder('mika', 1, 3, 1001);
    const paidForGoods = order.subtotalCents - order.discountCents;
    const before = await stock(1);

    for (let i = 0; i < 3; i++) {
      const created = await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1));
      expect(created.status).toBe(201);
      const rid = created.body.return._id;
      expect((await seller.patch(`/api/returns/${rid}/decision`).send({ decision: 'approve' })).status).toBe(
        200,
      );
      expect((await seller.patch(`/api/returns/${rid}/received`)).status).toBe(200);
    }
    const refunded = (await Order.findById(order._id)).refundedCents;
    const sum = (await ReturnRequest.find({ order: order._id })).reduce((s, r) => s + r.refundCents, 0);
    expect(refunded).toBe(sum);
    expect(refunded).toBeLessThanOrEqual(paidForGoods);
    expect(paidForGoods - refunded).toBeLessThanOrEqual(3); // at most a centavo lost per return
    expect(await stock(1)).toBe(before + 3);

    // Every unit is back, so nothing more can be asked for.
    expect((await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1))).status).toBe(400);
  });

  it("keeps a declined return's units from being asked for again", async () => {
    const mika = await signIn('mika');
    const seller = await signIn(sellerKeyOf(1));
    const order = await deliveredOrder('mika', 1, 2, 0);
    const created = await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 2));
    await seller
      .patch(`/api/returns/${created.body.return._id}/decision`)
      .send({ decision: 'decline', note: 'Scuffs are from use.' });
    expect((await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1))).status).toBe(400);
  });

  it('rejects malformed item lists with 400, not a crash', async () => {
    const mika = await signIn('mika');
    const order = await deliveredOrder('mika', 1, 1, 0);
    expect(
      (await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1, { items: [null] }))).status,
    ).toBe(400);
    expect(
      (await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1, { items: 'x' }))).status,
    ).toBe(400);
  });

  it('records a refund once, and only by the shop that sold it', async () => {
    const mika = await signIn('mika');
    const seller = await signIn(sellerKeyOf(1));
    const other = await signIn(['northpaw', 'glide', 'hush'].find((k) => k !== sellerKeyOf(1)));
    const order = await deliveredOrder('mika', 1, 1, 0);
    const rid = (await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1))).body.return._id;
    expect((await other.patch(`/api/returns/${rid}/decision`).send({ decision: 'approve' })).status).toBe(
      404,
    );
    await seller.patch(`/api/returns/${rid}/decision`).send({ decision: 'approve' });
    const before = await stock(1);
    const [a, b] = await Promise.all([
      seller.patch(`/api/returns/${rid}/received`),
      seller.patch(`/api/returns/${rid}/received`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect((await Order.findById(order._id)).refundedCents).toBe(order.subtotalCents);
    expect(await stock(1)).toBe(before + 1);
  });
});

describe('qa: marking an order received', () => {
  it("404s on someone else's order or a bad id", async () => {
    const lea = await signIn('lea');
    const shipped = await Order.findOne({ status: 'shipped', user: { $ne: id('lea') } });
    expect((await lea.patch(`/api/orders/${shipped._id}/received`)).status).toBe(404);
    expect((await lea.patch('/api/orders/not-an-id/received')).status).toBe(404);
    expect((await Order.findById(shipped._id)).status).toBe('shipped');
  });
});

describe('qa: seed data', () => {
  it('seeds shipped orders that the start-up auto-complete leaves alone', async () => {
    expect(checkouts.some(([, , status]) => status === 'shipped')).toBe(true);
    expect(await autoCompleteShipped()).toBe(0);
  });

  it('seeds a delivered order still inside the return window', async () => {
    const cutoff = new Date(Date.now() - 6 * DAY_MS);
    const recent = await Order.find({
      status: 'delivered',
      statusHistory: { $elemMatch: { status: 'delivered', at: { $gte: cutoff } } },
    });
    expect(recent.length).toBeGreaterThan(0);
  });
});

// Suspends a seller, so it runs last.
describe('qa: cancelling a suspended shop', () => {
  it('restocks unshipped orders, leaves shipped ones, and returns a code once the whole checkout is cancelled', async () => {
    const n = 1;
    const sellerKey = sellerKeyOf(n);
    const mika = await signIn('mika');
    const admin = await signIn('admin');
    const before = await stock(n);
    const placed = await mika.post('/api/orders').send({
      items: [{ productId: productId(n), qty: 2 }],
      shippingAddress: address,
      paymentMethod: 'cod',
      couponCode: 'WELCOME200',
    });
    expect(placed.status).toBe(201);
    expect(await stock(n)).toBe(before - 2);
    expect((await Coupon.findOne({ code: 'WELCOME200' })).usedBy.map(String)).toContain(id('mika'));

    const shipped = await Order.findOne({ seller: id(sellerKey), status: 'shipped' });
    expect(
      (await admin.patch(`/api/admin/sellers/${id(sellerKey)}`).send({ status: 'suspended' })).status,
    ).toBe(200);

    const order = await Order.findById(placed.body.orders[0]._id);
    expect(order).toMatchObject({ status: 'cancelled', cancelledBy: 'admin' });
    expect(order.statusHistory.at(-1).status).toBe('cancelled');
    if (shipped) expect((await Order.findById(shipped._id)).status).toBe('shipped');
    expect(
      await Order.countDocuments({ seller: id(sellerKey), status: { $in: ['placed', 'processing'] } }),
    ).toBe(0);
    expect(await stock(n)).toBeGreaterThanOrEqual(before);
    expect((await Coupon.findOne({ code: 'WELCOME200' })).usedBy.map(String)).not.toContain(id('mika'));

    // Suspending again restocks nothing twice.
    const stockAfter = await stock(n);
    await admin.patch(`/api/admin/sellers/${id(sellerKey)}`).send({ status: 'suspended' });
    expect(await stock(n)).toBe(stockAfter);
  });
});

describe('returns: the window, codes and reviews', () => {
  const refundAll = async (customer, order, qty) => {
    const agent = await signIn(customer);
    const seller = await signIn(sellerKeyOf(products.findIndex((p) => String(p._id) === String(order.items[0].product)) + 1));
    const created = await agent.post(`/api/orders/${order._id}/returns`).send(ask(order, qty));
    expect(created.status).toBe(201);
    const rid = created.body.return._id;
    await seller.patch(`/api/returns/${rid}/decision`).send({ decision: 'approve' });
    expect((await seller.patch(`/api/returns/${rid}/received`)).status).toBe(200);
  };

  it("doesn't let a seller's early delivered mark start the return window before the parcel could arrive", async () => {
    const mika = await signIn('mika');
    const order = await deliveredOrder('mika', 2, 1, 0);
    // Shipped and marked delivered by the shop 10 days ago: past 7 days, but the automatic completion
    // would only have been 3 days ago, so the window is still open.
    const at = new Date(Date.now() - 10 * DAY_MS);
    await Order.updateOne(
      { _id: order._id },
      { deliveredBy: 'seller', statusHistory: [{ status: 'placed', at }, { status: 'shipped', at }, { status: 'delivered', at }] },
    );
    expect((await mika.post(`/api/orders/${order._id}/returns`).send(ask(order, 1))).status).toBe(201);

    // The customer's own confirmation counts as given.
    const confirmed = await deliveredOrder('mika', 2, 1, 0);
    await Order.updateOne(
      { _id: confirmed._id },
      { deliveredBy: 'customer', statusHistory: [{ status: 'placed', at }, { status: 'shipped', at }, { status: 'delivered', at }] },
    );
    expect((await mika.post(`/api/orders/${confirmed._id}/returns`).send(ask(confirmed, 1))).body.error.code).toBe(
      'NOT_RETURNABLE',
    );
  });

  it('gives the code use back once the whole checkout is refunded, not before', async () => {
    await Coupon.create({ code: 'REFUNDME', type: 'fixed', value: 1000, usedCount: 1, usedBy: [id('lea')] });
    const order = await deliveredOrder('lea', 12, 2, 1000);
    await Order.updateOne({ _id: order._id }, { couponCode: 'REFUNDME' });

    await refundAll('lea', order, 1);
    expect((await Coupon.findOne({ code: 'REFUNDME' })).usedBy.map(String)).toContain(id('lea'));
    await refundAll('lea', order, 1);
    const coupon = await Coupon.findOne({ code: 'REFUNDME' });
    expect(coupon.usedBy.map(String)).not.toContain(id('lea'));
    expect(coupon.usedCount).toBe(0);
  });

  it('keeps a refunded buyer’s review but tags it', async () => {
    const paolo = await signIn('paolo');
    const order = await deliveredOrder('paolo', 13, 1, 0);
    await paolo.post(`/api/products/${productId(13)}/reviews`).send({ rating: 2, title: 'Arrived broken', body: 'The scroll wheel was cracked out of the box.' });
    await refundAll('paolo', order, 1);
    const { body } = await paolo.get(`/api/products/${productId(13)}/reviews?limit=50`);
    const mine = body.items.find((r) => r.user?._id === id('paolo'));
    expect(mine.returned).toBe(true);
    expect(body.items.filter((r) => r.user?._id !== id('paolo')).every((r) => r.returned === false)).toBe(true);
  });
});
