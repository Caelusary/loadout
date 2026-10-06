import { describe, expect, it } from 'vitest';
import { Order, Product } from '../src/models/index.js';
import { PHOTO_VERSION } from '../src/seed/data.js';
import { updatePhotoVersions, withPhotoVersion } from '../src/seed/photos.js';
import { productId, useSeededDb } from './helpers.js';

useSeededDb();

describe('photo cache-buster', () => {
  it('rewrites only bundled product photos', () => {
    expect(withPhotoVersion('/products/glide-vane-mini.webp?v=7', 9)).toBe('/products/glide-vane-mini.webp?v=9');
    expect(withPhotoVersion('/products/glide-vane-mini-2.webp', 9)).toBe('/products/glide-vane-mini-2.webp?v=9');
    expect(withPhotoVersion('/api/files/upload-123.webp', 9)).toBe('/api/files/upload-123.webp');
    expect(withPhotoVersion('https://res.cloudinary.com/demo/image/upload/a.webp', 9)).toBe(
      'https://res.cloudinary.com/demo/image/upload/a.webp',
    );
    expect(withPhotoVersion(undefined, 9)).toBeUndefined();
  });

  it('updates stale URLs in products and order snapshots, and leaves uploads alone', async () => {
    const upload = '/api/files/upload-123.webp';
    await Product.updateOne(
      { _id: productId(1) },
      { $set: { 'images.0.url': '/products/old.webp?v=3', 'images.1.url': upload } },
    );
    const order = await Order.findOne({ 'items.image': { $exists: true } });
    order.items[0].image = '/products/old.webp?v=3';
    await order.save();

    const counts = await updatePhotoVersions();

    expect(counts.products).toBeGreaterThanOrEqual(1);
    expect(counts.orders).toBeGreaterThanOrEqual(1);
    const product = await Product.findById(productId(1));
    expect(product.images[0].url).toBe(`/products/old.webp?v=${PHOTO_VERSION}`);
    expect(product.images[1].url).toBe(upload);
    expect((await Order.findById(order._id)).items[0].image).toBe(`/products/old.webp?v=${PHOTO_VERSION}`);
    // A second run finds nothing left to change.
    expect(await updatePhotoVersions()).toEqual({ products: 0, orders: 0 });
  });
});
