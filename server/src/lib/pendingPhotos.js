import { Order, PendingPhoto, Product, Review } from '../models/index.js';
import { deleteFile } from './storage.js';

export const PENDING_PHOTO_HOURS = 24;

// Whether anything still shows this file: a product's photos or model, an order's line photo, delivery proof or
// missed-delivery photo, or a review. Any account can paste any of this app's file URLs into its own product or
// review, so every delete checks all of them, or dropping a borrowed URL would delete someone else's file.
export async function fileInUse(url) {
  const used = await Promise.all([
    Product.exists({ $or: [{ 'images.url': url }, { modelUrl: url }] }),
    Order.exists({ $or: [{ 'items.image': url }, { 'deliveryProof.url': url }, { 'attempts.photo': url }] }),
    Review.exists({ images: url }),
  ]);
  return used.some(Boolean);
}

// Deletes the files nothing uses any more.
export const deleteUnused = (urls) =>
  Promise.all(urls.filter(Boolean).map(async (url) => (await fileInUse(url)) || deleteFile({ url })));

export const trackUpload = (url, user, kind) => PendingPhoto.create({ url, user, kind });

// Called once a review or delivery saves with these photos: they're in use now, so the cleanup leaves them alone.
export const claimUploads = (urls) => (urls?.length ? PendingPhoto.deleteMany({ url: { $in: urls } }) : null);

// Hourly: deletes photos nobody attached within a day. Checks the reviews and orders too, in case a claim was missed,
// so a photo in use is never deleted.
export async function purgeAbandonedPhotos(now = new Date()) {
  const cutoff = new Date(now.getTime() - PENDING_PHOTO_HOURS * 60 * 60 * 1000);
  const stale = await PendingPhoto.find({ createdAt: { $lte: cutoff } }).limit(200);
  let deleted = 0;
  for (const { _id, url } of stale) {
    if (!(await fileInUse(url))) {
      await deleteFile({ url }).catch(() => {});
      deleted += 1;
    }
    await PendingPhoto.deleteOne({ _id });
  }
  return deleted;
}
