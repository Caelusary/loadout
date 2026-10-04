import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Product } from '../src/models/index.js';
import { app, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

describe('sale prices', () => {
  it('lets a seller put a product on sale and end it, with the regular price above the sale price', async () => {
    const glide = await signIn('glide');
    const pid = productId(12); // Glide Flick Wired, ₱1,490
    const set = (body) => glide.patch(`/api/products/${pid}`).send(body);

    const wrong = await set({ compareAtCents: 100000 });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.compareAtCents).toMatch(/higher than the sale price/);

    const onSale = await set({ priceCents: 119000, compareAtCents: 149000 });
    expect(onSale.body.product).toMatchObject({ priceCents: 119000, compareAtCents: 149000 });
    const listed = await request(app).get('/api/products?onSale=1&limit=48');
    expect(listed.body.items.map((p) => p._id)).toContain(pid);
    expect(listed.body.items.every((p) => p.compareAtCents > p.priceCents)).toBe(true);

    const ended = await set({ priceCents: 149000, compareAtCents: null });
    expect(ended.body.product.compareAtCents).toBeUndefined();
  });

  it("won't show a struck-through price above the lowest regular price of the last 30 days", async () => {
    const glide = await signIn('glide');
    const pid = productId(12);
    const set = (body) => glide.patch(`/api/products/${pid}`).send(body);

    // Raise the price, then "discount" it back to where it was: the old price is the real one.
    const raised = await set({ priceCents: 199000 });
    expect(raised.status).toBe(200);
    expect(raised.body.product.priceLog).toBeUndefined();
    const fake = await set({ priceCents: 149000, compareAtCents: 199000 });
    expect(fake.status).toBe(400);
    expect(fake.body.error.fields.compareAtCents).toMatch(/at most ₱1,490/);
    expect((await set({ priceCents: 129000, compareAtCents: 149000 })).status).toBe(200);

    // Once the higher price has stood for 30 days, it's the regular price.
    await set({ priceCents: 199000, compareAtCents: null });
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await Product.updateOne({ _id: pid }, { priceLog: [{ cents: 199000, at: old }] });
    expect((await set({ priceCents: 159000, compareAtCents: 199000 })).status).toBe(200);
    await set({ priceCents: 149000, compareAtCents: null });
  });

  it('charges the sale price at checkout', async () => {
    const mika = await signIn('mika');
    const res = await request(app).get('/api/products?onSale=1');
    const sale = res.body.items[0];
    await mika.delete('/api/cart');
    const order = await mika.post('/api/orders').send({
      items: [{ productId: sale._id, qty: 1 }],
      shippingAddress: { fullName: 'Mika Reyes', line1: '1 Test St', city: 'Pasig', province: 'Metro Manila', postalCode: '1600', phone: '09171234567' },
      paymentMethod: 'cod',
    });
    expect(order.status).toBe(201);
    expect(order.body.orders[0].items[0].priceCents).toBe(sale.priceCents);
  });
});
