import { describe, expect, it } from 'vitest';
import { Order, Product, Review, RiderFeedback, User } from '../src/models/index.js';
import { fileInUse } from '../src/lib/pendingPhotos.js';
import { signIn, useSeededDb } from './helpers.js';

useSeededDb();

describe('deactivating a rider', () => {
  it('refuses while a parcel is out with them, and hands orders not picked up to another rider', async () => {
    const waiting = await Order.findOne({ status: 'shipped', rider: { $ne: null } });
    const riderId = String(waiting.rider);
    const owner = await signIn('owner');

    const out = await Order.findOneAndUpdate(
      { _id: { $ne: waiting._id }, status: { $in: ['delivered', 'shipped'] } },
      { status: 'out-for-delivery', rider: riderId },
      { new: true },
    );
    const refused = await owner.patch(`/api/admin/users/${riderId}`).send({ isActive: false });
    expect(refused.status).toBe(400);
    expect((await User.findById(riderId)).isActive).toBe(true);

    await Order.updateOne({ _id: out._id }, { status: 'delivered' });
    const done = await owner.patch(`/api/admin/users/${riderId}`).send({ isActive: false });
    expect(done.status).toBe(200);
    expect(await Order.countDocuments({ rider: riderId, status: 'shipped' })).toBe(0);
  });
});

describe('a rider whose account is gone', () => {
  it('can still have their flagged feedback marked reviewed', async () => {
    const feedback = await RiderFeedback.findOne({ flagged: true, reviewedAt: null });
    await User.deleteOne({ _id: feedback.rider });
    const owner = await signIn('owner');
    expect((await owner.patch(`/api/admin/rider-feedback/${feedback._id}`).send({ note: 'checked' })).status).toBe(200);
    expect((await owner.get('/api/admin/rider-feedback')).status).toBe(200);
  });
});

describe('stored files', () => {
  it('count as in use when a review or a delivery photo holds them, not only a product', async () => {
    const proof = '/api/files/proof-test.webp';
    const reviewPhoto = '/api/files/review-test.webp';
    await Order.updateOne({ status: 'delivered' }, { deliveryProof: { url: proof, at: new Date() } });
    const review = await Review.findOne();
    await Review.updateOne({ _id: review._id }, { $push: { images: reviewPhoto } });
    expect(await fileInUse(proof)).toBe(true);
    expect(await fileInUse(reviewPhoto)).toBe(true);
    expect(await fileInUse('/api/files/nobody.webp')).toBe(false);
    expect(await Product.exists({ 'images.url': proof })).toBeNull();
  });
});
