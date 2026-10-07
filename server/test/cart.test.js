import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Product, User } from '../src/models/index.js';
import { address, app, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

// Ids and quantities only; each line also carries the price when added (checked in hardening.test.js).
const items = (res) => res.body.items.map(({ productId, qty }) => ({ productId, qty }));

describe('cart', () => {
  it('is only for signed-in customers and sellers', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
    const admin = await signIn('admin');
    expect((await admin.get('/api/cart')).status).toBe(403);
  });

  it('adds, merges, sets, removes and clears, and follows the account', async () => {
    const mika = await signIn('mika');
    expect(items(await mika.get('/api/cart'))).toEqual([]);

    await mika.post(`/api/cart/${productId(2)}`).send({ qty: 2 });
    const merged = await mika.post(`/api/cart/${productId(2)}`).send({ qty: 1 });
    expect(items(merged)).toEqual([{ productId: productId(2), qty: 3 }]);

    await mika.post(`/api/cart/${productId(12)}`).send({});
    const set = await mika.put(`/api/cart/${productId(2)}`).send({ qty: 5 });
    expect(items(set)).toEqual([
      { productId: productId(2), qty: 5 },
      { productId: productId(12), qty: 1 },
    ]);

    // Stored on the account: a fresh sign-in (another device) sees the same cart.
    const elsewhere = await signIn('mika');
    expect(items(await elsewhere.get('/api/cart'))).toHaveLength(2);

    expect(items(await mika.delete(`/api/cart/${productId(2)}`))).toEqual([{ productId: productId(12), qty: 1 }]);
    expect(items(await mika.delete('/api/cart'))).toEqual([]);
  });

  it('applies the same rules as checkout, with a message for each', async () => {
    const mika = await signIn('mika');
    for (const qty of [0, 1.5, 11, 'two']) {
      const res = await mika.post(`/api/cart/${productId(2)}`).send({ qty });
      expect(res.status).toBe(400);
      expect(res.body.error.fields.qty).toBeTruthy();
    }

    await mika.post(`/api/cart/${productId(2)}`).send({ qty: 8 });
    const overCap = await mika.post(`/api/cart/${productId(2)}`).send({ qty: 3 });
    expect(overCap.status).toBe(400);
    expect(overCap.body.error.fields.qty).toMatch(/at most 10/);

    const stock = (await Product.findById(productId(22)).lean()).stock;
    const tooMany = await mika.post(`/api/cart/${productId(22)}`).send({ qty: stock + 1 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('OUT_OF_STOCK');

    await Product.updateOne({ _id: productId(3) }, { isActive: false });
    const unlisted = await mika.post(`/api/cart/${productId(3)}`).send({ qty: 1 });
    expect(unlisted.status).toBe(409);
    expect(unlisted.body.error.code).toBe('UNAVAILABLE');

    expect((await mika.post('/api/cart/not-an-id').send({ qty: 1 })).status).toBe(404);
    expect((await mika.put(`/api/cart/${productId(5)}`).send({ qty: 1 })).status).toBe(404); // not in the cart

    const glide = await signIn('glide');
    const own = await glide.post(`/api/cart/${productId(12)}`).send({ qty: 1 });
    expect(own.status).toBe(422);
    expect(own.body.error.code).toBe('OWN_PRODUCT');
  });

  it('takes bought items out of the cart at checkout, and only those', async () => {
    const mika = await signIn('mika');
    await mika.post(`/api/cart/${productId(2)}`).send({ qty: 1 });
    await mika.post(`/api/cart/${productId(12)}`).send({ qty: 1 });

    const res = await mika
      .post('/api/orders')
      .send({ items: [{ productId: productId(2), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(res.status).toBe(201);
    expect(items(await mika.get('/api/cart'))).toEqual([{ productId: productId(12), qty: 1 }]);

    // A failed checkout leaves the cart as it was.
    const user = await User.findOne({ email: 'mika@loadout.test' });
    await Product.updateOne({ _id: productId(12) }, { stock: 0 });
    const failed = await mika
      .post('/api/orders')
      .send({ items: [{ productId: productId(12), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(failed.status).toBe(409);
    expect((await User.findById(user._id)).cart).toHaveLength(1);
  });

  it('checks out only the ticked items from the cart, and keeps the rest', async () => {
    const mika = await signIn('mika');
    await mika.delete('/api/cart');
    await mika.post(`/api/cart/${productId(14)}`).send({ qty: 1 });
    await mika.post(`/api/cart/${productId(15)}`).send({ qty: 2 });

    const res = await mika
      .post('/api/orders')
      .send({ fromCart: true, items: [{ productId: productId(15), qty: 2 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(res.status).toBe(201);
    expect(items(await mika.get('/api/cart'))).toEqual([{ productId: productId(14), qty: 1 }]);

    // A ticked item whose quantity changed in another tab is refused rather than bought at the old quantity.
    await mika.put(`/api/cart/${productId(14)}`).send({ qty: 3 });
    const stale = await mika
      .post('/api/orders')
      .send({ fromCart: true, items: [{ productId: productId(14), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(stale.body.error.code).toBe('CART_CHANGED');
    await mika.delete('/api/cart');
  });

  it('leaves the cart alone for a buy-now checkout, even when the item is also in the cart', async () => {
    const mika = await signIn('mika');
    await mika.post(`/api/cart/${productId(2)}`).send({ qty: 2 });

    const res = await mika
      .post('/api/orders')
      .send({ buyNow: true, items: [{ productId: productId(2), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(res.status).toBe(201);
    expect(items(await mika.get('/api/cart'))).toContainEqual({ productId: productId(2), qty: 2 });
  });
});
