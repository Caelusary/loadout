import { describe, expect, it } from 'vitest';
import { Product, Review, User } from '../src/models/index.js';
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

describe('shops', () => {
  it('lists every approved shop with its listed product count, and no private fields', async () => {
    const res = await request(app).get('/api/shops');
    expect(res.status).toBe(200);
    const names = res.body.shops.map((s) => s.shopName);
    expect(names).toContain('Lumen Desk');
    expect(names).not.toContain('Coilworks'); // still pending
    const allowed = ['bio', 'logoUrl', 'productCount', 'shopName', 'slug'];
    for (const shop of res.body.shops) {
      expect(Object.keys(shop).filter((k) => !allowed.includes(k))).toEqual([]);
      const owner = await User.findOne({ 'sellerProfile.slug': shop.slug });
      expect(shop.productCount).toBe(await Product.countDocuments({ seller: owner._id, isActive: true }));
    }
  });
});

describe('review list', () => {
  it('counts every review per star, and filters and sorts without changing those counts', async () => {
    const aster = productId(1); // seeded with ratings 5, 5, 5, 4, 4, 3 (Mika plus the earlier buyers)
    const all = (await request(app).get(`/api/products/${aster}/reviews`)).body;
    const total = Object.values(all.breakdown).reduce((a, b) => a + b, 0);
    expect(total).toBe(all.total);
    expect(all.breakdown[5]).toBeGreaterThan(0);

    const fives = (await request(app).get(`/api/products/${aster}/reviews?stars=5`)).body;
    expect(fives.items.every((r) => r.rating === 5)).toBe(true);
    expect(fives.total).toBe(all.breakdown[5]);
    expect(fives.breakdown).toEqual(all.breakdown);

    const lowest = (await request(app).get(`/api/products/${aster}/reviews?sort=lowest`)).body.items.map((r) => r.rating);
    expect(lowest).toEqual([...lowest].sort((a, b) => a - b));
    const highest = (await request(app).get(`/api/products/${aster}/reviews?sort=highest`)).body.items.map((r) => r.rating);
    expect(highest).toEqual([...highest].sort((a, b) => b - a));

    // Nonsense is ignored rather than refused.
    expect((await request(app).get(`/api/products/${aster}/reviews?stars=9&sort=bogus`)).body.total).toBe(all.total);
  });
});

describe('review votes', () => {
  it('lets other shoppers vote once each, either way, and never shows who voted', async () => {
    const aster = productId(1);
    const review = await Review.findOne({ product: aster, user: users.mika._id });
    const url = `/api/reviews/${review._id}/vote`;
    // A shopper who hasn't voted on it yet (the seed hands out some votes).
    const voted = [...review.helpful, ...review.unhelpful].map(String);
    const key = Object.keys(users).find((k) => users[k].role === 'customer' && k !== 'mika' && !voted.includes(String(users[k]._id)));
    const paolo = await signIn(key);
    const before = review.helpful.length;

    const up = await paolo.put(url).send({ vote: 'up' });
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ likes: before + 1, myVote: 'up' });
    // Again changes nothing; switching moves the vote.
    expect((await paolo.put(url).send({ vote: 'up' })).body.likes).toBe(before + 1);
    const down = await paolo.put(url).send({ vote: 'down' });
    expect(down.body).toMatchObject({ likes: before, myVote: 'down' });
    const stored = await Review.findById(review._id);
    expect(stored.helpfulCount).toBe(stored.helpful.length);

    // The list carries counts and the viewer's own vote, not the voters.
    const listed = (await paolo.get(`/api/products/${aster}/reviews`)).body.items.find((r) => r._id === String(review._id));
    expect(listed).toMatchObject({ myVote: 'down', dislikes: down.body.dislikes });
    expect(listed.helpful).toBeUndefined();
    expect(listed.unhelpful).toBeUndefined();
    expect((await paolo.put(url).send({ vote: 'none' })).body.myVote).toBe(null);

    // Not your own review, not the product's own shop, not admins; and only up, down or none.
    const mika = await signIn('mika');
    expect((await mika.put(url).send({ vote: 'up' })).status).toBe(403);
    expect((await (await signIn('northpaw')).put(url).send({ vote: 'up' })).status).toBe(403);
    expect((await (await signIn('admin')).put(url).send({ vote: 'up' })).status).toBe(403);
    expect((await paolo.put(url).send({ vote: 'sideways' })).status).toBe(400);
    expect((await request(app).put(url).send({ vote: 'up' })).status).toBe(401);
  });

  it('sorts by most helpful when asked', async () => {
    const items = (await request(app).get(`/api/products/${productId(1)}/reviews?sort=helpful`)).body.items;
    const likes = items.map((r) => r.likes);
    expect(likes).toEqual([...likes].sort((a, b) => b - a));
  });
});
