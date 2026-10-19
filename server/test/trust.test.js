import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Notification, Order, PendingPhoto, Product, Review, StockAlert } from '../src/models/index.js';
import { purgeAbandonedPhotos } from '../src/lib/pendingPhotos.js';
import { UPLOAD_DIR } from '../src/lib/storage.js';
import { stripMetadata } from '../src/lib/stripMetadata.js';
import { checkStock } from '../src/features/products/stockAlerts.js';
import { paymentState } from '../src/features/orders/payment.js';
import { users } from '../src/seed/data.js';
import { address, productId, riderStep, signIn, tinyPng, useSeededDb } from './helpers.js';

useSeededDb();

const id = (key) => String(users[key]._id);
const keyOf = (riderId) => Object.keys(users).find((k) => id(k) === String(riderId));
const DAY_MS = 24 * 60 * 60 * 1000;
const GLIDE_PRODUCT = 12;

async function shipped() {
  const buyer = await signIn('mika');
  const placed = await buyer
    .post('/api/orders')
    .send({ items: [{ productId: productId(GLIDE_PRODUCT), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
  const order = placed.body.orders[0];
  const shop = await signIn('glide');
  for (const status of ['processing', 'shipped']) await shop.patch(`/api/orders/${order._id}/status`).send({ status });
  const { rider } = await Order.findById(order._id).lean();
  return { order, buyer, shop, rider: await signIn(keyOf(rider)) };
}

describe('proof of delivery', () => {
  it('needs the rider’s own photo, and keeps where they were for admins only', async () => {
    const { order, buyer, shop, rider } = await shipped();
    await rider.patch(`/api/deliveries/${order._id}`).send({ status: 'out-for-delivery' });
    const bare = await rider.patch(`/api/deliveries/${order._id}`).send({ status: 'delivered' });
    expect(bare.status).toBe(400);
    expect(bare.body.error.fields.proof).toBeTruthy();
    // Another account's upload doesn't count.
    const borrowed = await rider
      .patch(`/api/deliveries/${order._id}`)
      .send({ status: 'delivered', proof: { url: '/api/files/someone-else.png' } });
    expect(borrowed.status).toBe(400);

    const done = await riderStep(rider, order._id, 'delivered');
    expect(done.status).toBe(200);
    const url = done.body.order.deliveryProof.url;
    expect(await PendingPhoto.exists({ url })).toBeNull(); // claimed, so the cleanup leaves it alone

    const seen = async (agent) => (await agent.get(`/api/orders/${order._id}`)).body.order.deliveryProof;
    expect((await seen(buyer)).url).toBe(url);
    expect((await seen(buyer)).location).toBeUndefined();
    expect((await seen(shop)).location).toBeUndefined();
    expect((await seen(rider)).location).toBeUndefined();
    expect((await seen(await signIn('owner'))).location).toMatchObject({ lat: 14.6, lng: 121.03 });
    const list = await buyer.get('/api/orders/mine');
    expect(JSON.stringify(list.body)).not.toContain('121.03');
  });
});

describe('payment holding', () => {
  it('holds until the buyer confirms or the window passes, and refunds an upheld report', () => {
    const base = { status: 'delivered', subtotalCents: 10000, discountCents: 1000, statusHistory: [{ status: 'delivered', at: new Date() }] };
    expect(paymentState({ ...base, status: 'shipped' })).toMatchObject({ state: 'held', until: 'delivery', amountCents: 9000 });
    expect(paymentState(base)).toMatchObject({ state: 'held', until: 'buyer' });
    expect(paymentState({ ...base, receivedAt: new Date() }).state).toBe('released');
    const old = { ...base, statusHistory: [{ status: 'delivered', at: new Date(Date.now() - 8 * DAY_MS) }] };
    expect(paymentState(old).state).toBe('released');
    expect(paymentState({ ...old, deliveryIssue: { status: 'open' } })).toMatchObject({ state: 'held', until: 'report' });
    expect(paymentState({ ...base, deliveryIssue: { status: 'resolved' } }).state).toBe('refunded');
    expect(paymentState({ ...base, status: 'cancelled' }).state).toBe('none');
  });

  it('shows the shop what is held and released, and the order page says which', async () => {
    const { order, shop } = await shipped();
    const stats = await shop.get('/api/seller/stats');
    expect(stats.body.payouts.heldCents).toBeGreaterThan(0);
    expect(stats.body.payouts).toHaveProperty('releasedCents30d');
    expect((await shop.get(`/api/orders/${order._id}`)).body.order.payment).toMatchObject({ state: 'held', until: 'delivery' });
  });
});

describe('stock alerts', () => {
  it('tells a waiting shopper when a sold-out product is back, and the shop once when it runs low', async () => {
    const product = await Product.findById(productId(GLIDE_PRODUCT));
    await Product.updateOne({ _id: product._id }, { stock: 0 });
    const mika = await signIn('mika');
    const url = `/api/products/${product._id}/stock-alert`;
    expect((await (await signIn('joy')).put(url)).status).toBe(403); // riders don't shop
    expect((await mika.put(url)).body.subscribed).toBe(true);
    expect((await mika.get(url)).body.subscribed).toBe(true);

    await checkStock();
    expect(await Notification.countDocuments({ user: id('glide'), title: `${product.name} is sold out` })).toBe(1);
    await checkStock();
    expect(await Notification.countDocuments({ user: id('glide'), title: `${product.name} is sold out` })).toBe(1);

    await Product.updateOne({ _id: product._id }, { stock: 20 });
    await checkStock();
    expect(await Notification.exists({ user: id('mika'), title: `${product.name} is back in stock` })).toBeTruthy();
    expect(await StockAlert.exists({ product: product._id })).toBeNull();
    // In stock now, so there's nothing to wait for.
    expect((await mika.put(url)).status).toBe(400);
  });
});

describe('shop replies to reviews', () => {
  it('lets only the product’s shop post one reply, edit it and take it down', async () => {
    // The newest unanswered review, so it's on the first page of its shop's inbox.
    const review = await Review.findOne({ reply: { $exists: false } }).sort({ createdAt: -1 }).populate('product', 'seller');
    const shopKey = keyOf(review.product.seller);
    const url = `/api/reviews/${review._id}/reply`;
    expect((await (await signIn('mika')).put(url).send({ body: 'Hello there' })).status).toBe(404);
    const shop = await signIn(shopKey);
    expect((await shop.put(url).send({ body: '' })).status).toBe(400);
    const first = await shop.put(url).send({ body: 'Thanks for the review!' });
    expect(first.status).toBe(200);
    expect(await Notification.exists({ user: review.user, title: /replied to your review/ })).toBeTruthy();
    const edited = await shop.put(url).send({ body: 'Thanks, glad it works for you.' });
    expect(edited.body.reply.editedAt).toBeTruthy();
    const listed = await shop.get(`/api/products/${review.product._id}/reviews`);
    expect(listed.body.items.find((r) => r._id === String(review._id)).reply.body).toBe('Thanks, glad it works for you.');
    expect((await shop.delete(url)).status).toBe(200);
    expect((await Review.findById(review._id).lean()).reply).toBeUndefined();
  });

  it('lists a shop’s own reviews, unanswered ones on their own tab, and keeps other shops and buyers out', async () => {
    // The newest unanswered review, so it's on the first page of its shop's inbox.
    const review = await Review.findOne({ reply: { $exists: false } }).sort({ createdAt: -1 }).populate('product', 'seller');
    const shop = await signIn(keyOf(review.product.seller));
    const inbox = await shop.get('/api/seller/reviews?needs=reply');
    expect(inbox.status).toBe(200);
    expect(inbox.body.items.map((r) => r._id)).toContain(String(review._id));
    expect(inbox.body.counts.needsReply).toBe(inbox.body.total);
    // Everything listed belongs to this shop.
    const mine = await Product.distinct('_id', { seller: review.product.seller });
    const all = await shop.get('/api/seller/reviews');
    expect(all.body.items.every((r) => mine.some((id) => String(id) === r.product._id))).toBe(true);
    // Answered reviews leave the "needs a reply" tab.
    await shop.put(`/api/reviews/${review._id}/reply`).send({ body: 'Thanks for the review!' });
    const after = await shop.get('/api/seller/reviews?needs=reply');
    expect(after.body.items.map((r) => r._id)).not.toContain(String(review._id));
    expect(after.body.counts.needsReply).toBe(inbox.body.counts.needsReply - 1);
    expect((await (await signIn('mika')).get('/api/seller/reviews')).status).toBe(403);
    await shop.delete(`/api/reviews/${review._id}/reply`);
  });
});

describe('photo housekeeping', () => {
  it('deletes review photos that were never posted after a day, and keeps used ones', async () => {
    const buyer = await signIn('mika');
    const upload = await buyer.post('/api/reviews/photos').attach('file', tinyPng, 'a.png');
    expect(upload.status).toBe(201);
    const file = path.join(UPLOAD_DIR, path.basename(upload.body.url));
    expect(fs.existsSync(file)).toBe(true);
    expect(await purgeAbandonedPhotos()).toBe(0); // still fresh
    expect(await purgeAbandonedPhotos(new Date(Date.now() + 25 * 60 * 60 * 1000))).toBe(1);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('removes EXIF from a JPEG without touching the picture', () => {
    const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x08]), Buffer.from('Exif\0\0')]);
    const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), exif, scan]);
    const clean = stripMetadata(jpeg, 'jpg');
    expect(clean.includes(Buffer.from('Exif'))).toBe(false);
    expect(clean.subarray(-scan.length).equals(scan)).toBe(true);
  });
});

describe('admin menu counts', () => {
  it('counts only the areas the admin manages', async () => {
    const owner = await signIn('owner');
    const res = await owner.get('/api/admin/counts');
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual(
      expect.objectContaining({ riders: expect.any(Number), complaints: expect.any(Number), returns: expect.any(Number) }),
    );
    // Complaints is rider feedback to read plus open "not received" reports.
    const { complaints, riderFeedback, deliveryReports } = res.body.counts;
    expect(complaints).toBe(riderFeedback + deliveryReports);
    expect(complaints).toBeGreaterThan(0);
    // Approvals is shop applications plus rider vehicle changes.
    expect(res.body.counts.approvals).toBe(res.body.counts.sellers + res.body.counts.riders);
    expect((await (await signIn('mika')).get('/api/admin/counts')).status).toBe(403);
  });
});

describe('admin users list', () => {
  it('counts every role for the search in use, and adds what matters for each row', async () => {
    const admin = await signIn('admin');
    const all = (await admin.get('/api/admin/users?limit=100')).body;
    expect(all.roleCounts.all).toBe(all.total);
    expect(all.roleCounts.rider).toBe(all.items.filter((u) => u.role === 'rider').length);
    const joy = all.items.find((u) => u.email === 'joy@loadout.test');
    expect(joy.rating).toEqual({ avg: expect.any(Number), count: expect.any(Number) });
    expect(all.items.find((u) => u.role === 'customer').orderCount).toEqual(expect.any(Number));
    expect(all.items.find((u) => u.role === 'seller').listedCount).toEqual(expect.any(Number));

    // A role filter narrows the rows but keeps the counts for every role.
    const riders = (await admin.get('/api/admin/users?role=rider')).body;
    expect(riders.items.every((u) => u.role === 'rider')).toBe(true);
    expect(riders.roleCounts).toEqual(all.roleCounts);
  });
});
