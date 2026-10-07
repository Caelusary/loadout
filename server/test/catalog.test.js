import { describe, expect, it } from 'vitest';
import { Product } from '../src/models/index.js';
import { users } from '../src/seed/data.js';
import request from 'supertest';
import { app, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

const review = { rating: 4, title: 'Solid pick', body: 'Arrived quickly and works exactly as described.' };

describe('reviews', () => {
  it('only accepts one review from a buyer with a delivered order, and updates the rating', async () => {
    const tern = productId(2); // Lea has a delivered order for it and has already reviewed it
    const pip = productId(4); // Paolo has a delivered order, and reviewed it with 3 stars
    const paolo = await signIn('paolo');
    const mika = await signIn('mika');

    expect((await mika.post(`/api/products/${pip}/reviews`).send(review)).status).toBe(403);
    expect((await paolo.post(`/api/products/${pip}/reviews`).send(review)).status).toBe(409);

    const cable = productId(7); // Paolo received 2, no review yet
    const created = await paolo.post(`/api/products/${cable}/reviews`).send({ ...review, rating: 2 });
    expect(created.status).toBe(201);
    const product = await Product.findById(cable).lean();
    expect(product.ratingAvg).toBe(2);
    expect(product.ratingCount).toBe(1);

    const lea = await signIn('lea');
    const list = await lea.get(`/api/products/${tern}/reviews`);
    expect(list.body.canReview).toBe(false);
    expect(list.body.myReviewId).toBeTruthy();
  });
});

describe('products', () => {
  it('matches every typed word against names, categories, and specs', async () => {
    const names = async (q) => (await request(app).get('/api/products').query({ q })).body.items.map((p) => p.name).sort();
    // Neither word is in these products' names: "wireless" is a spec, "mice" a category alias.
    expect(await names('wireless mice')).toEqual(['Glide Vane Air', 'Glide Vane Mini', 'Glide Vane Pro']);
    expect(await names('75% keyboard')).toEqual(['Northpaw Aster 75 Wireless', 'Northpaw Ridge 75']);
    expect(await names('northpaw')).toHaveLength(10);
    expect(await names('(unclosed [regex')).toEqual([]);
  });

  it('lets the CDN share public product lists, but not cart refreshes or the admin view', async () => {
    const cdn = async (path, agent = request(app)) => (await agent.get(path)).headers['cdn-cache-control'];
    expect(await cdn('/api/products?category=mouse')).toMatch(/max-age=60/);
    expect(await cdn('/api/products/featured')).toMatch(/max-age=60/);
    expect(await cdn(`/api/products?ids=${productId(2)}`)).toBeUndefined();
    expect(await cdn('/api/products?includeInactive=1', await signIn('admin'))).toBeUndefined();
  });

  it('falls back to newest for sort names it does not know', async () => {
    // "constructor" is a property of every object; it must not be mistaken for a sort option.
    for (const sort of ['constructor', '__proto__', 'nope']) {
      const res = await request(app).get('/api/products').query({ sort });
      expect(res.status).toBe(200);
    }
  });

  it("won't let a seller edit another seller's product", async () => {
    const glide = await signIn('glide');
    const res = await glide.patch(`/api/products/${productId(1)}`).send({ priceCents: 100 });
    expect(res.status).toBe(404);
    expect((await Product.findById(productId(1)).lean()).priceCents).toBe(649000);
  });

  it('rejects asset URLs the app did not store', async () => {
    const glide = await signIn('glide');
    const res = await glide
      .patch(`/api/products/${productId(12)}`)
      .send({ images: [{ url: 'https://evil.example/x.png', alt: 'x' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.images).toBeTruthy();
  });

  it('unlists every product of a suspended seller and blocks relisting', async () => {
    const admin = await signIn('admin');
    const hushId = users.hush._id.toString();

    expect((await admin.patch(`/api/admin/sellers/${hushId}`).send({ status: 'suspended' })).status).toBe(200);
    const active = await Product.countDocuments({ seller: hushId, isActive: true });
    expect(active).toBe(0);
    const relist = await admin.patch(`/api/admin/products/${productId(17)}`).send({ isActive: true });
    expect(relist.status).toBe(409);
  });
});
