import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ActivityLog, Notification, Order, Review } from '../src/models/index.js';
import { UPLOAD_DIR } from '../src/lib/storage.js';
import { users } from '../src/seed/data.js';
import { address, app, productId, signIn, useSeededDb, riderStep } from './helpers.js';

useSeededDb();

const id = (key) => String(users[key]._id);
const DAY_MS = 24 * 60 * 60 * 1000;
const GLIDE_PRODUCT = 12; // sold by Glide Lab; Mika has never ordered it, so he can review it once it's delivered

// A fresh order from `buyerKey`, taken to `upTo` by its shop and then its rider.
async function orderUpTo(upTo, buyerKey = 'mika') {
  const buyer = await signIn(buyerKey);
  const placed = await buyer
    .post('/api/orders')
    .send({ items: [{ productId: productId(GLIDE_PRODUCT), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
  const order = placed.body.orders[0];
  const shop = await signIn('glide');
  for (const step of ['processing', 'shipped']) await shop.patch(`/api/orders/${order._id}/status`).send({ status: step });
  const { rider } = await Order.findById(order._id).lean();
  const riderKey = Object.keys(users).find((k) => id(k) === String(rider));
  const rideAgent = await signIn(riderKey);
  const steps = { shipped: [], 'out-for-delivery': ['out-for-delivery'], delivered: ['out-for-delivery', 'delivered'] }[upTo];
  for (const status of steps) await riderStep(rideAgent, order._id, status);
  return { order, buyer, shop, rider: rideAgent, riderKey };
}

describe('"did it arrive?"', () => {
  it('asks the buyer once an order is delivered, and only the buyer can answer', async () => {
    const early = await orderUpTo('out-for-delivery');
    const tooSoon = await early.buyer.patch(`/api/orders/${early.order._id}/received`);
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.error.code).toBe('NOT_DELIVERED');

    const { order, buyer, rider } = await orderUpTo('delivered');
    const waiting = async () => (await buyer.get('/api/orders/mine?awaiting=receipt')).body.items.map((o) => o._id);
    expect(await waiting()).toContain(order._id);
    // The bell carries the question too.
    const notice = await Notification.findOne({ user: id('mika'), title: new RegExp(`${order._id.slice(-6)}`, 'i'), body: /Did it arrive/ });
    expect(notice).toBeTruthy();

    expect((await rider.patch(`/api/orders/${order._id}/received`)).status).toBe(404);
    expect((await (await signIn('lea')).patch(`/api/orders/${order._id}/received`)).status).toBe(404);
    expect((await request(app).patch(`/api/orders/${order._id}/received`)).status).toBe(401);

    const answered = await buyer.patch(`/api/orders/${order._id}/received`);
    expect(answered.status).toBe(200);
    expect(answered.body.order.receivedAt).toBeTruthy();
    expect((await buyer.patch(`/api/orders/${order._id}/received`)).status).toBe(200); // answering twice is harmless
    expect(await waiting()).not.toContain(order._id);

    // Having said it arrived, they can't also say it didn't.
    const late = await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({});
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ALREADY_RECEIVED');
  });

  it('stops asking once the 7 days are over, and then a report is refused', async () => {
    const { order, buyer } = await orderUpTo('delivered');
    await Order.updateOne(
      { _id: order._id },
      { $set: { statusHistory: [{ status: 'placed' }, { status: 'delivered', at: new Date(Date.now() - 9 * DAY_MS) }] } },
    );
    expect((await buyer.get('/api/orders/mine?awaiting=receipt')).body.items.map((o) => o._id)).not.toContain(order._id);
    const res = await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('WINDOW_PASSED');
  });
});

describe('a delivery report', () => {
  it('tells the shop, the rider and the admins, and keeps the buyer’s words from the rider', async () => {
    const { order, buyer, shop, rider } = await orderUpTo('delivered');
    const tooLong = await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({ note: 'x'.repeat(301) });
    expect(tooLong.status).toBe(400);

    const sent = await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({ note: 'Nobody came to the door.' });
    expect(sent.status).toBe(200);
    expect(sent.body.order.deliveryIssue).toMatchObject({ status: 'open', note: 'Nobody came to the door.' });

    // Once only, and no confirming it afterwards.
    expect((await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({})).body.error.code).toBe('ISSUE_REPORTED');
    expect((await buyer.patch(`/api/orders/${order._id}/received`)).body.error.code).toBe('ISSUE_REPORTED');
    expect((await buyer.get('/api/orders/mine?awaiting=receipt')).body.items.map((o) => o._id)).not.toContain(order._id);

    const { rider: riderId } = await Order.findById(order._id).lean();
    const told = await Notification.distinct('user', { title: /was reported as not received/, link: `/orders/${order._id}` });
    expect(told.map(String)).toEqual(expect.arrayContaining([id('glide'), id('owner'), id('admin'), String(riderId)]));

    // The note is for the buyer, the shop and admins; the rider only learns that there is a report.
    expect((await buyer.get(`/api/orders/${order._id}`)).body.order.deliveryIssue.note).toBe('Nobody came to the door.');
    expect((await shop.get(`/api/orders/${order._id}`)).body.order.deliveryIssue.note).toBe('Nobody came to the door.');
    const riderView = (await rider.get(`/api/orders/${order._id}`)).body.order.deliveryIssue;
    expect(riderView.status).toBe('open');
    expect(riderView.note).toBeUndefined();
    const done = (await rider.get('/api/deliveries?view=done')).body.items.find((o) => o._id === order._id);
    expect(done.deliveryIssue.note).toBeUndefined();

    // Admins can list the open ones.
    const admin = await signIn('admin');
    expect((await admin.get('/api/admin/orders?issue=open')).body.items.map((o) => o._id)).toContain(order._id);
  });

  it('is settled by an admin with a note, which is logged and sent to everyone involved', async () => {
    const { order, buyer, shop, rider } = await orderUpTo('delivered');
    await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({});
    const settle = (agent, body) => agent.patch(`/api/admin/orders/${order._id}/delivery-issue`).send(body);

    for (const agent of [buyer, shop, rider]) expect((await settle(agent, { decision: 'resolve', note: 'All sorted.' })).status).toBe(403);
    const admin = await signIn('admin');
    const noNote = await settle(admin, { decision: 'resolve', note: '' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.error.fields.note).toBeTruthy();
    expect((await settle(admin, { decision: 'maybe', note: 'Unsure' })).body.error.fields.decision).toBeTruthy();

    const res = await settle(admin, { decision: 'resolve', note: 'The rider confirmed a failed attempt. Re-sent.' });
    expect(res.status).toBe(200);
    expect(res.body.order.deliveryIssue).toMatchObject({ status: 'resolved', resolution: 'The rider confirmed a failed attempt. Re-sent.' });
    expect((await ActivityLog.findOne({ action: 'order.delivery-issue' })).undoable).toBe(false);
    for (const user of [id('mika'), id('glide')]) {
      expect(await Notification.exists({ user, title: /Delivery report on .* was resolved/, link: `/orders/${order._id}` })).toBeTruthy();
    }
    // Final: it can't be settled twice.
    expect((await settle(admin, { decision: 'dismiss', note: 'Changed my mind' })).status).toBe(409);
  });

  it('holds back reviews while it is open, and lets them through once it is settled', async () => {
    // Lea, not Mika: Mika already has other delivered orders of this product, which would let him review regardless.
    const { order, buyer } = await orderUpTo('delivered', 'lea');
    await buyer.post(`/api/orders/${order._id}/delivery-issue`).send({});
    const review = { rating: 4, title: 'Works well', body: 'Clicks are crisp and the cable is light.' };
    const blocked = await buyer.post(`/api/products/${productId(GLIDE_PRODUCT)}/reviews`).send(review);
    expect(blocked.status).toBe(403);
    expect((await buyer.get(`/api/products/${productId(GLIDE_PRODUCT)}/reviews`)).body.canReview).toBe(false);

    const admin = await signIn('admin');
    await admin.patch(`/api/admin/orders/${order._id}/delivery-issue`).send({ decision: 'dismiss', note: 'The courier log shows it was handed over.' });
    expect((await buyer.post(`/api/products/${productId(GLIDE_PRODUCT)}/reviews`).send(review)).status).toBe(201);
  });
});

describe('review photos', () => {
  // The smallest thing the uploader accepts as a PNG: its signature, padded.
  const png = (size = 64) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(size)]);
  const upload = (agent, buffer, name = 'photo.png') => agent.post('/api/reviews/photos').attach('file', buffer, name);
  const onDisk = (url) => fs.existsSync(path.join(UPLOAD_DIR, path.basename(url)));
  const review = { rating: 2, title: 'Not what I hoped', body: 'The shell flexes and the wheel rattles a little.' };

  it('lets buyers with a delivered order upload photos, and checks what they upload', async () => {
    const { buyer, rider } = await orderUpTo('delivered');
    expect((await upload(rider, png())).status).toBe(403);
    expect((await upload(await signIn('admin'), png())).status).toBe(403);
    expect((await request(app).post('/api/reviews/photos').attach('file', png(), 'p.png')).status).toBe(401);

    expect((await upload(buyer, Buffer.from('not an image at all'), 'photo.png')).status).toBe(400);
    expect((await upload(buyer, png(), 'photo.gif')).status).toBe(400);
    expect((await upload(buyer, png(2 * 1024 * 1024), 'big.png')).status).toBe(413);

    const ok = await upload(buyer, png());
    expect(ok.status).toBe(201);
    expect(onDisk(ok.body.url)).toBe(true);
    fs.rmSync(path.join(UPLOAD_DIR, path.basename(ok.body.url)), { force: true });
  });

  it('attaches up to 3 of them to a review, lists them, and cleans up when they are removed', async () => {
    const { buyer } = await orderUpTo('delivered');
    const product = productId(GLIDE_PRODUCT);
    const urls = [];
    for (let i = 0; i < 3; i += 1) urls.push((await upload(buyer, png(64 + i))).body.url);

    // Only the uploader's own files count, and no more than three.
    for (const images of [['https://evil.example/x.png'], ['/products/northpaw-numpad.webp'], 'not-a-list', [...urls, urls[0] + '?x=1']]) {
      expect((await buyer.post(`/api/products/${product}/reviews`).send({ ...review, images })).status).toBe(400);
    }
    const created = await buyer.post(`/api/products/${product}/reviews`).send({ ...review, images: urls });
    expect(created.status).toBe(201);
    expect(created.body.review.images).toEqual(urls);

    const all = (await request(app).get(`/api/products/${product}/reviews`)).body;
    expect(all.photoCount).toBe(1);
    const withPhotos = (await request(app).get(`/api/products/${product}/reviews?photos=1`)).body;
    expect(withPhotos.items.map((r) => r._id)).toEqual([created.body.review._id]);
    expect(withPhotos.items[0].images).toEqual(urls);

    // Taking a photo off deletes the file; deleting the review deletes the rest.
    const edited = await buyer.patch(`/api/reviews/${created.body.review._id}`).send({ images: [urls[0]] });
    expect(edited.body.review.images).toEqual([urls[0]]);
    expect(onDisk(urls[1])).toBe(false);
    expect(onDisk(urls[0])).toBe(true);
    await buyer.delete(`/api/reviews/${created.body.review._id}`);
    expect(onDisk(urls[0])).toBe(false);
    expect(await Review.countDocuments({ _id: created.body.review._id })).toBe(0);
  });
});
