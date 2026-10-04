import { describe, expect, it } from 'vitest';
import { Notification, Order, Product, User } from '../src/models/index.js';
import { users } from '../src/seed/data.js';
import { address, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

describe('admin discount codes', () => {
  it('validates new codes on the server', async () => {
    const admin = await signIn('admin');
    const create = (body) => admin.post('/api/admin/coupons').send(body);

    const tooMuch = await create({ code: 'HALFOFF95', type: 'percent', value: 95 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.error.fields.value).toMatch(/at most 90/);

    const typo = await create({ code: 'BIGFIXED', type: 'fixed', value: 6000000 });
    expect(typo.status).toBe(400);
    expect(typo.body.error.fields.value).toMatch(/50,000/);

    expect((await create({ code: 'ab', type: 'percent', value: 10 })).body.error.fields.code).toBeDefined();
    expect((await create({ code: 'NOTYPE', value: 10 })).body.error.fields.type).toBeDefined();
    expect((await create({ code: 'ZEROUSE', type: 'percent', value: 10, maxUses: 0 })).status).toBe(400);

    const ok = await create({ code: 'fresh15', type: 'percent', value: 15, usedCount: 99 });
    expect(ok.status).toBe(201);
    expect(ok.body.coupon).toMatchObject({ code: 'FRESH15', usedCount: 0 });

    const dup = await create({ code: 'FRESH15', type: 'fixed', value: 100 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.code).toBeDefined();
  });

  it('is admin-only', async () => {
    const mika = await signIn('mika');
    expect((await mika.post('/api/admin/coupons').send({ code: 'SNEAKY1', type: 'percent', value: 90 })).status).toBe(403);
    expect((await mika.get('/api/admin/coupons')).status).toBe(403);
  });
});

describe('seller applications', () => {
  it('validates the application, then lets an admin approve it into a seller account', async () => {
    const paolo = await signIn('paolo');
    const bad = await paolo.post('/api/users/me/seller-application').send({ shopName: 'x' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields['sellerProfile.shopName']).toBeDefined();

    const applied = await paolo.post('/api/users/me/seller-application').send({ shopName: 'Paolo Parts', bio: 'Spare keycaps.' });
    expect(applied.status).toBe(201);
    expect(applied.body.user.sellerProfile).toMatchObject({ status: 'pending', slug: 'paolo-parts' });
    expect((await paolo.post('/api/users/me/seller-application').send({ shopName: 'Again Shop' })).status).toBe(409);
    // Pending applicants can't list yet.
    expect((await paolo.get('/api/products/mine')).status).toBe(403);

    const admin = await signIn('admin');
    const approved = await admin.patch(`/api/admin/sellers/${users.paolo._id}`).send({ status: 'approved' });
    expect(approved.status).toBe(200);
    expect(approved.body.user.role).toBe('seller');
    expect(await Notification.exists({ user: users.paolo._id, type: 'seller' })).toBeTruthy();
    expect((await paolo.get('/api/products/mine')).status).toBe(200);
  });
});

describe('account deletion', () => {
  it('refuses while the account has open orders', async () => {
    const lea = await signIn('lea');
    const placed = await lea
      .post('/api/orders')
      .send({ items: [{ productId: productId(19), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(placed.status).toBe(201);

    const admin = await signIn('admin');
    const res = await admin.delete(`/api/admin/users/${users.lea._id}`);
    expect(res.status).toBe(409);
    expect(await User.exists({ _id: users.lea._id })).toBeTruthy();
    expect(await Order.countDocuments({ user: users.lea._id })).toBeGreaterThan(0);
  });

  it("unlists a deleted seller's products instead of orphaning live listings", async () => {
    const glide = users.glide._id;
    expect(await Product.exists({ seller: glide, isActive: true })).toBeTruthy();
    // Deletion is only allowed once the shop's orders are closed; seeded history keeps the rest.
    await Order.updateMany({ seller: glide, status: { $in: ['placed', 'processing', 'shipped'] } }, { status: 'delivered' });
    const admin = await signIn('admin');
    const res = await admin.delete(`/api/admin/users/${glide}`);
    expect(res.status).toBe(200);
    expect(await User.exists({ _id: glide })).toBeFalsy();
    expect(await Product.exists({ seller: glide, isActive: true })).toBeFalsy();
    const shop = await (await signIn('mika')).get('/api/products?category=mouse');
    expect(shop.body.items.every((p) => p.seller)).toBe(true);
  });
});
