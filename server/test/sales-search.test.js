import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Order, Product } from '../src/models/index.js';
import { settleSales } from '../src/features/products/service.js';
import { users } from '../src/seed/data.js';
import { address, app, productId, signIn, useSeededDb, riderStep } from './helpers.js';

useSeededDb();

const DAY_MS = 24 * 60 * 60 * 1000;
const GLIDE_PRODUCT = 12; // sold by Glide Lab

async function glideProduct() {
  const product = await Product.findById(productId(GLIDE_PRODUCT)).lean();
  const regular = product.compareAtCents ?? product.priceCents;
  return { product, regular, sale: Math.round(regular * 0.8) };
}

describe('scheduled sales', () => {
  it('parks a sale that starts later, starts it on the day and ends it after its last day', async () => {
    const shop = await signIn('glide');
    const { product, regular, sale } = await glideProduct();
    const startsAt = new Date(Date.now() + 2 * DAY_MS);
    const endsAt = new Date(Date.now() + 5 * DAY_MS);
    const saved = await shop
      .patch(`/api/products/${product._id}`)
      .send({ priceCents: sale, compareAtCents: regular, saleStartsAt: startsAt, saleEndsAt: endsAt });
    expect(saved.status).toBe(200);
    expect(saved.body.product.priceCents).toBe(regular);
    expect(saved.body.product.compareAtCents).toBeUndefined();
    expect(saved.body.product.upcomingSale.priceCents).toBe(sale);

    // Shoppers don't see a sale coming.
    const shopper = await request(app).get(`/api/products/${product.slug}`);
    expect(shopper.body.product.upcomingSale).toBeUndefined();
    expect(shopper.body.product.priceCents).toBe(regular);

    await settleSales(new Date(startsAt.getTime() + 1000));
    let now = await Product.findById(product._id).select('+upcomingSale').lean();
    expect(now).toMatchObject({ priceCents: sale, compareAtCents: regular });
    expect(now.upcomingSale).toBeUndefined();

    await settleSales(new Date(endsAt.getTime() + 1000));
    now = await Product.findById(product._id).lean();
    expect(now.priceCents).toBe(regular);
    expect(now.compareAtCents).toBeUndefined();
    expect(now.saleEndsAt).toBeUndefined();
  });

  it('starts a sale with no start date at once, and rejects an end before the start or in the past', async () => {
    const shop = await signIn('glide');
    const { product, regular, sale } = await glideProduct();
    const url = `/api/products/${product._id}`;
    const past = await shop
      .patch(url)
      .send({ priceCents: sale, compareAtCents: regular, saleEndsAt: new Date(Date.now() - DAY_MS) });
    expect(past.status).toBe(400);
    expect(past.body.error.fields.saleEndsAt).toBeTruthy();
    const backwards = await shop.patch(url).send({
      priceCents: sale,
      compareAtCents: regular,
      saleStartsAt: new Date(Date.now() + 3 * DAY_MS),
      saleEndsAt: new Date(Date.now() + 2 * DAY_MS),
    });
    expect(backwards.status).toBe(400);

    const now = await shop
      .patch(url)
      .send({ priceCents: sale, compareAtCents: regular, saleEndsAt: new Date(Date.now() + DAY_MS) });
    expect(now.status).toBe(200);
    expect(now.body.product).toMatchObject({ priceCents: sale, compareAtCents: regular });
    expect(now.body.product.saleEndsAt).toBeTruthy();

    // Ending the sale clears its end date too.
    const off = await shop.patch(url).send({ priceCents: regular, compareAtCents: null });
    expect(off.body.product.saleEndsAt).toBeUndefined();
  });

  it('charges the sale price at checkout even before the minute job runs', async () => {
    const shop = await signIn('glide');
    const { product, regular, sale } = await glideProduct();
    await shop.patch(`/api/products/${product._id}`).send({
      priceCents: sale,
      compareAtCents: regular,
      saleStartsAt: new Date(Date.now() + DAY_MS),
    });
    // The start date passes without the job running.
    await Product.updateOne({ _id: product._id }, { 'upcomingSale.startsAt': new Date(Date.now() - 1000) });
    const buyer = await signIn('mika');
    const placed = await buyer
      .post('/api/orders')
      .send({
        items: [{ productId: String(product._id), qty: 1 }],
        shippingAddress: address,
        paymentMethod: 'cod',
      });
    expect(placed.status).toBe(201);
    expect(placed.body.orders[0].items[0].priceCents).toBe(sale);
  });
});

describe('price words in search', () => {
  it('"sale" shows only items on sale, and says so', async () => {
    const res = await request(app).get('/api/products?q=sale');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((p) => p.compareAtCents > p.priceCents)).toBe(true);
    expect(res.body.intent).toEqual({ sale: true, cheap: false });
  });

  it('"cheap" is the cheapest third of each category, cheapest first', async () => {
    const res = await request(app).get('/api/products?q=cheap+mouse&limit=48');
    expect(res.body.total).toBeGreaterThan(0);
    const mice = await Product.find({ isActive: true, category: 'mouse' }).sort({ priceCents: 1 }).lean();
    const cutoff = mice[Math.ceil(mice.length / 3) - 1].priceCents;
    expect(res.body.items.every((p) => p.category === 'mouse' && p.priceCents <= cutoff)).toBe(true);
    const prices = res.body.items.map((p) => p.priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('leaves ordinary searches alone', async () => {
    const res = await request(app).get('/api/products?q=mouse');
    expect(res.body.intent).toBeUndefined();
  });
});

describe('what a rider keeps', () => {
  it('drops the buyer’s street and phone once the order is delivered', async () => {
    const buyer = await signIn('mika');
    const placed = await buyer
      .post('/api/orders')
      .send({
        items: [{ productId: productId(GLIDE_PRODUCT), qty: 1 }],
        shippingAddress: address,
        paymentMethod: 'cod',
      });
    const order = placed.body.orders[0];
    const shop = await signIn('glide');
    for (const step of ['processing', 'shipped'])
      await shop.patch(`/api/orders/${order._id}/status`).send({ status: step });
    const { rider } = await Order.findById(order._id).lean();
    const riderAgent = await signIn(Object.keys(users).find((k) => String(users[k]._id) === String(rider)));

    const active = await riderAgent.get(`/api/orders/${order._id}`);
    expect(active.body.order.shippingAddress.phone).toBe(address.phone);

    await riderAgent.patch(`/api/deliveries/${order._id}`).send({ status: 'out-for-delivery' });
    const done = await riderStep(riderAgent, order._id, 'delivered');
    expect(done.body.order.shippingAddress).toEqual({ city: address.city, province: address.province });
    const later = await riderAgent.get(`/api/orders/${order._id}`);
    expect(later.body.order.shippingAddress.phone).toBeUndefined();
    expect(later.body.order.shippingAddress.line1).toBeUndefined();
    const list = await riderAgent.get('/api/deliveries?view=done');
    const row = list.body.items.find((o) => o._id === order._id);
    expect(row.shippingAddress.phone).toBeUndefined();

    // The buyer still sees everything.
    expect((await buyer.get(`/api/orders/${order._id}`)).body.order.shippingAddress.phone).toBe(
      address.phone,
    );
  });
});
