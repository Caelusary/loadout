import { pathToFileURL } from 'node:url';
import { Order, Product } from '../models/index.js';
import { PHOTO_VERSION } from './data.js';

// Bundled product photos carry a ?v= cache-buster (see PHOTO_VERSION). After a re-render the seed uses
// the new number, but a live database still holds the old URLs, so visitors' browsers keep their cached
// copies. This rewrites those URLs in place: product images and the image snapshot on each order line.
// Only bundled photos (/products/<file>.webp) change; seller uploads and Cloudinary URLs are left alone.
const BUNDLED = /^(\/products\/[^/?]+\.webp)(\?v=\d+)?$/;

export function withPhotoVersion(url, version = PHOTO_VERSION) {
  const match = typeof url === 'string' && url.match(BUNDLED);
  return match ? `${match[1]}?v=${version}` : url;
}

export async function updatePhotoVersions(version = PHOTO_VERSION) {
  let products = 0;
  for (const product of await Product.find({ 'images.url': BUNDLED }).select('images')) {
    let changed = false;
    for (const image of product.images) {
      const next = withPhotoVersion(image.url, version);
      if (next !== image.url) [image.url, changed] = [next, true];
    }
    if (changed) {
      await product.save();
      products++;
    }
  }
  let orders = 0;
  for (const order of await Order.find({ 'items.image': BUNDLED }).select('items')) {
    let changed = false;
    for (const item of order.items) {
      const next = withPhotoVersion(item.image, version);
      if (next !== item.image) [item.image, changed] = [next, true];
    }
    if (changed) {
      await order.save();
      orders++;
    }
  }
  return { products, orders };
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  await import('dotenv/config');
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI to the database whose photo URLs should be updated.');
    process.exit(1);
  }
  const { connectDB, disconnectDB } = await import('../config/db.js');
  await connectDB();
  console.log(`Photo URLs set to v=${PHOTO_VERSION}:`, await updatePhotoVersions());
  await disconnectDB();
}
