import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Order, Product, User } from '../src/models/index.js';
import { address, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

const checkout = (agent, items, extra = {}) =>
  agent.post('/api/orders').send({ items, shippingAddress: address, paymentMethod: 'cod', ...extra });

describe('checkout', () => {
  it("refuses a second tab's checkout of a cart the first tab already bought", async () => {
    const paolo = await signIn('paolo');
    const pid = productId(6);
    await paolo.delete('/api/cart');
    await paolo.post(`/api/cart/${pid}`).send({ qty: 2 });
    const items = [{ productId: pid, qty: 2 }];

    expect((await checkout(paolo, [{ productId: pid, qty: 1 }], { fromCart: true })).body.error.code).toBe('CART_CHANGED');
    expect((await checkout(paolo, items, { fromCart: true })).status).toBe(201);
    const second = await checkout(paolo, items, { fromCart: true });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CART_CHANGED');
  });

  it('places a resent checkout only once, even when both copies arrive together', async () => {
    const lea = await signIn('lea');
    const pid = productId(5);
    const stock = async () => (await Product.findById(pid).lean()).stock;
    const before = await stock();
    const checkoutId = randomUUID();

    const [a, b] = await Promise.all([1, 2].map(() => checkout(lea, [{ productId: pid, qty: 1 }], { checkoutId })));
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const again = await checkout(lea, [{ productId: pid, qty: 1 }], { checkoutId });
    expect(again.status).toBe(200);
    expect(again.body.repeated).toBe(true);
    expect(again.body.orders.map((o) => o._id)).toEqual(a.body.orders.map((o) => o._id));
    expect(await Order.countDocuments({ checkoutId })).toBe(1);
    expect(await stock()).toBe(before - 1);
  });

  it('prices from the database, splits per seller and reserves stock', async () => {
    const mika = await signIn('mika');
    const [kb, mouse] = [productId(2), productId(12)];
    const before = await Product.find({ _id: { $in: [kb, mouse] } }).lean();

    const res = await checkout(mika, [
      { productId: kb, qty: 1, priceCents: 1 },
      { productId: mouse, qty: 2 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.orders).toHaveLength(2);
    expect(new Set(res.body.orders.map((o) => o.checkoutId)).size).toBe(1);
    const kbOrder = res.body.orders.find((o) => o.items[0].product === kb);
    expect(kbOrder.items[0].priceCents).toBe(485000);
    expect(kbOrder.shippingCents).toBe(0);
    const mouseOrder = res.body.orders.find((o) => o.items[0].product === mouse);
    expect(mouseOrder.subtotalCents).toBe(298000);
    expect(mouseOrder.totalCents).toBe(298000 + 15000);

    const after = await Product.find({ _id: { $in: [kb, mouse] } }).lean();
    const stock = (list, id) => list.find((p) => p._id.toString() === id).stock;
    expect(stock(after, kb)).toBe(stock(before, kb) - 1);
    expect(stock(after, mouse)).toBe(stock(before, mouse) - 2);
  });

  it('rejects the whole checkout when one item is short, reserving nothing', async () => {
    const paolo = await signIn('paolo');
    const plenty = productId(15);
    const scarce = productId(22); // seed stock: 2
    const before = await Product.findById(plenty).lean();

    const res = await checkout(paolo, [
      { productId: plenty, qty: 1 },
      { productId: scarce, qty: 3 },
    ]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
    expect(res.body.error.details.productId).toBe(scarce);
    expect((await Product.findById(plenty).lean()).stock).toBe(before.stock);
    expect((await Product.findById(scarce).lean()).stock).toBe(2);
  });
});

describe('order access and status', () => {
  const orderFor = async (customerKey) => {
    const agent = await signIn(customerKey);
    const res = await checkout(agent, [{ productId: productId(16), qty: 1 }]); // Glide Lab
    return { agent, order: res.body.orders[0] };
  };

  it("hides another customer's order and shows it to its seller", async () => {
    const { order } = await orderFor('mika');
    const lea = await signIn('lea');
    const glide = await signIn('glide');
    const hush = await signIn('hush');

    expect((await lea.get(`/api/orders/${order._id}`)).status).toBe(404);
    expect((await hush.get(`/api/orders/${order._id}`)).status).toBe(404);
    expect((await glide.get(`/api/orders/${order._id}`)).status).toBe(200);
  });

  it('lets the seller move forward only, one step at a time', async () => {
    const { order } = await orderFor('mika');
    const glide = await signIn('glide');
    const move = (status) => glide.patch(`/api/orders/${order._id}/status`).send({ status });

    expect((await move('shipped')).status).toBe(422);
    expect((await move('processing')).status).toBe(200);
    expect((await move('cancelled')).status).toBe(422);
    expect((await move('placed')).status).toBe(422);
    expect((await move('shipped')).body.order.status).toBe('shipped');
  });

  it('lets a customer cancel only while placed, and restocks', async () => {
    const pad = productId(16);
    const start = (await Product.findById(pad).lean()).stock;
    const { agent, order } = await orderFor('paolo');

    const res = await agent.patch(`/api/orders/${order._id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.order.cancelledBy).toBe('customer');
    expect((await Product.findById(pad).lean()).stock).toBe(start);
    expect((await agent.patch(`/api/orders/${order._id}/cancel`)).status).toBe(422);

    const second = await orderFor('paolo');
    const glide = await signIn('glide');
    await glide.patch(`/api/orders/${second.order._id}/status`).send({ status: 'processing' });
    expect((await second.agent.patch(`/api/orders/${second.order._id}/cancel`)).status).toBe(422);
  });

  it('lets an admin cancel a shipped order but not a delivered one', async () => {
    const { order } = await orderFor('lea');
    const glide = await signIn('glide');
    for (const status of ['processing', 'shipped']) {
      await glide.patch(`/api/orders/${order._id}/status`).send({ status });
    }
    const admin = await signIn('admin');
    const res = await admin.patch(`/api/orders/${order._id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.order.cancelledBy).toBe('admin');

    const delivered = await Order.findOne({ status: 'delivered' });
    expect((await admin.patch(`/api/orders/${delivered._id}/cancel`)).status).toBe(422);
  });
});

describe('checkout validation', () => {
  it('merges duplicate cart lines and enforces the per-item cap on the merged quantity', async () => {
    const mika = await signIn('mika');
    const id = productId(13);
    const before = (await Product.findById(id).lean()).stock;

    const res = await checkout(mika, [
      { productId: id, qty: 6 },
      { productId: id, qty: 5 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error.fields.items).toMatch(/at most 10/);
    expect((await Product.findById(id).lean()).stock).toBe(before);

    for (const bad of [[], [{ productId: id, qty: 0 }], [{ productId: id, qty: 1.5 }], [{ productId: 'nope', qty: 1 }]]) {
      expect((await checkout(mika, bad)).status).toBe(400);
    }
  });

  it("won't let a seller buy their own product, and releases the stock", async () => {
    const northpaw = await signIn('northpaw');
    const own = productId(3);
    const before = (await Product.findById(own).lean()).stock;

    const res = await checkout(northpaw, [{ productId: own, qty: 1 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OWN_PRODUCT');
    expect((await Product.findById(own).lean()).stock).toBe(before);
  });

  it('rejects an invalid address or payment method with field errors and reserves nothing', async () => {
    const paolo = await signIn('paolo');
    const id = productId(14);
    const before = (await Product.findById(id).lean()).stock;
    const ordersBefore = await Order.countDocuments();

    const res = await checkout(paolo, [{ productId: id, qty: 1 }], {
      shippingAddress: { ...address, postalCode: 'abc', phone: '' },
      paymentMethod: 'bitcoin',
    });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['shippingAddress.postalCode', 'shippingAddress.phone', 'paymentMethod']),
    );
    expect((await Product.findById(id).lean()).stock).toBe(before);
    expect(await Order.countDocuments()).toBe(ordersBefore);
  });
});

describe('checkout under contention', () => {
  it('sells the last unit to exactly one of two simultaneous checkouts', async () => {
    const id = productId(5);
    const before = (await Product.findById(id).lean()).stock;
    const ordersBefore = await Order.countDocuments({ 'items.product': id });
    await Product.updateOne({ _id: id }, { stock: 1 });
    let placed = [];
    try {
      const [mika, lea] = await Promise.all([signIn('mika'), signIn('lea')]);
      const results = await Promise.all([checkout(mika, [{ productId: id, qty: 1 }]), checkout(lea, [{ productId: id, qty: 1 }])]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409).body.error.code).toBe('OUT_OF_STOCK');
      expect((await Product.findById(id).lean()).stock).toBe(0);
      placed = results.flatMap((r) => r.body.orders ?? []).map((o) => o._id);
      expect(await Order.countDocuments({ 'items.product': id })).toBe(ordersBefore + 1);
    } finally {
      await Order.deleteMany({ _id: { $in: placed } });
      await Product.updateOne({ _id: id }, { stock: before });
    }
    // The losing transaction hits a write conflict and is retried, which can run long on a busy machine.
  }, 60_000);

  it('refuses unknown, unlisted and malformed products without reserving anything', async () => {
    const paolo = await signIn('paolo');
    const unknown = await checkout(paolo, [{ productId: 'f'.repeat(24), qty: 1 }]);
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.code).toBe('UNAVAILABLE');

    const id = productId(5);
    const before = (await Product.findById(id).lean()).stock;
    await Product.updateOne({ _id: id }, { isActive: false });
    try {
      const unlisted = await checkout(paolo, [{ productId: id, qty: 1 }]);
      expect(unlisted.status).toBe(409);
      expect(unlisted.body.error.code).toBe('UNAVAILABLE');
      expect((await Product.findById(id).lean()).stock).toBe(before);
    } finally {
      await Product.updateOne({ _id: id }, { isActive: true });
    }

    for (const items of [undefined, [], 'abc', [{ productId: 'nope', qty: 1 }], [{ productId: id, qty: 1.5 }], [{ productId: id, qty: 0 }]]) {
      const res = await checkout(paolo, items);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('after the orders commit', () => {
  it('still reports success when saving the address fails, so a retry cannot buy twice', async () => {
    const lea = await signIn('lea');
    const id = productId(5);
    const before = (await Product.findById(id).lean()).stock;
    const save = vi.spyOn(User.prototype, 'save').mockRejectedValue(new Error('write failed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let placed = [];
    try {
      const res = await checkout(lea, [{ productId: id, qty: 1 }], { saveAddress: true });
      placed = (res.body.orders ?? []).map((o) => o._id);

      expect(res.status).toBe(201);
      expect(placed).toHaveLength(1);
      expect(res.body.addressSaved).toBe(false);
    } finally {
      save.mockRestore();
      warn.mockRestore();
      await Order.deleteMany({ _id: { $in: placed } });
      await Product.updateOne({ _id: id }, { stock: before });
    }
  });
});
