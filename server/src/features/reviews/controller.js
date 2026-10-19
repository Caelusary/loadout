import path from 'node:path';
import mongoose from 'mongoose';
import { Order, Product, ReturnRequest, Review } from '../../models/index.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { IMAGE_EXTS, imageTypeOf, MB } from '../../lib/images.js';
import { isId, pageParams, paginate, pick, sameId } from '../../lib/request.js';
import { claimUploads, deleteUnused, trackUpload } from '../../lib/pendingPhotos.js';
import { isAllowedAssetUrl, saveFile } from '../../lib/storage.js';
import { stripMetadata } from '../../lib/stripMetadata.js';
import { canManage } from '../../middleware/auth.js';
import { record } from '../activity/service.js';
import { notify } from '../notifications/service.js';

const FIELDS = ['rating', 'title', 'body'];
export const MAX_PHOTOS = 3;

// A delivered order with the product, unless its buyer has an open "not received" report on it: the review
// waits until an admin has settled what happened.
const hasDeliveredOrder = (userId, productId) =>
  Order.exists({
    user: userId,
    status: 'delivered',
    'items.product': productId,
    'deliveryIssue.status': { $ne: 'open' },
  });

// Only files from the review uploader count (a stored file or this app's own Cloudinary folder), so a review can't
// point at some other site's image.
const isReviewPhoto = (url) =>
  typeof url === 'string' && isAllowedAssetUrl(url) && (url.startsWith('/api/files/') || url.includes('/loadout/reviews/'));

function reviewInput(body) {
  const data = pick(body, FIELDS);
  if (body?.images !== undefined) {
    const images = body.images;
    if (!Array.isArray(images) || images.length > MAX_PHOTOS || !images.every(isReviewPhoto)) {
      throw invalid({ images: `Add up to ${MAX_PHOTOS} photos using the photo button.` });
    }
    data.images = [...new Set(images)];
  }
  return data;
}

// Another review may hold the same URL (anyone can paste one in), so only files nothing else uses are deleted.
const dropFiles = deleteUnused;

// Photos for a review. Anyone with a delivered order may upload (the same people who can review), a few at a time.
export async function uploadPhoto(req, res) {
  if (!(await Order.exists({ user: req.user._id, status: 'delivered' }))) {
    throw new AppError(403, 'FORBIDDEN', 'Only buyers with a delivered order can add review photos.');
  }
  if (!req.file) throw invalid({ file: 'Choose a photo to upload.' });
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
  if (!IMAGE_EXTS.includes(ext)) throw invalid({ file: 'Upload a JPG, PNG or WebP photo.' });
  if (req.file.size > 2 * MB) throw new AppError(413, 'FILE_TOO_LARGE', 'Photos must be 2 MB or smaller.');
  const type = imageTypeOf(req.file.buffer);
  if (!type) throw invalid({ file: 'That is not a valid JPG, PNG or WebP photo.' });
  // Review photos are public, so where they were taken is removed here too (the browser already tries).
  const stored = await saveFile(stripMetadata(req.file.buffer, type), { ext: type, kind: 'review' });
  // Deleted in a day unless a posted review uses it (see lib/pendingPhotos.js).
  await trackUpload(stored.url, req.user._id, 'review');
  res.status(201).json({ url: stored.url });
}

// How a product's reviews can be ordered (?sort=); newest first otherwise.
const REVIEW_SORTS = {
  helpful: { helpfulCount: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
};

export async function listReviews(req, res) {
  if (!isId(req.params.id)) throw notFound('That product');
  const product = req.params.id;
  // ?photos=1 lists only the reviews that have photos, like Shopee's "With media" filter; ?stars=1..5 only that
  // rating. Anything else in either is ignored rather than refused.
  const stars = Number(req.query.stars);
  const filter = {
    product,
    ...(req.query.photos === '1' && { 'images.0': { $exists: true } }),
    ...(Number.isInteger(stars) && stars >= 1 && stars <= 5 && { rating: stars }),
  };
  const sort = REVIEW_SORTS[req.query.sort] ?? REVIEW_SORTS.newest;
  const [result, photoCount, byStars] = await Promise.all([
    paginate(Review, filter, pageParams(req.query, { defaultLimit: 10 }), (q) =>
      q.sort(sort).populate('user', 'name'),
    ),
    Review.countDocuments({ product, 'images.0': { $exists: true } }),
    // The breakdown always covers every review of the product, whatever is filtered.
    Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(product) } },
      { $group: { _id: '$rating', n: { $sum: 1 } } },
    ]),
  ]);
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const { _id, n } of byStars) breakdown[_id] = n;

  // Who got a refund is the shop's business, not other shoppers': only the product's own shop and admins who
  // moderate products are told, so the flag never reaches the page for anyone else.
  const owner = await Product.findById(product).select('seller');
  const seesReturns = Boolean(req.user) && (sameId(owner?.seller, req.user) || canManage(req.user, 'products'));
  const returnedBy = seesReturns
    ? new Set(
        (
          await ReturnRequest.distinct('user', {
            status: 'refunded',
            'items.product': product,
            user: { $in: result.items.map((r) => r.user?._id).filter(Boolean) },
          })
        ).map(String),
      )
    : null;
  // Votes go out as counts plus the viewer's own vote; the lists of who voted stay here.
  const me = req.user ? String(req.user._id) : null;
  result.items = result.items.map((r) => ({
    ...r.toJSON(),
    likes: r.helpful.length,
    dislikes: r.unhelpful.length,
    myVote: !me ? null : r.helpful.some((u) => String(u) === me) ? 'up' : r.unhelpful.some((u) => String(u) === me) ? 'down' : null,
    ...(returnedBy && { returned: returnedBy.has(String(r.user?._id)) }),
  }));
  let canReview = false;
  let myReviewId = null;
  if (req.user) {
    const [mine, delivered] = await Promise.all([
      Review.findOne({ product, user: req.user._id }).select('_id'),
      hasDeliveredOrder(req.user._id, product),
    ]);
    myReviewId = mine?._id ?? null;
    canReview = !mine && Boolean(delivered);
  }
  res.json({ ...result, canReview, myReviewId, photoCount, breakdown });
}

// A shopper marks someone else's review helpful ('up') or not ('down'), or takes their vote back ('none'). One
// vote each, applied in a single update so two quick taps can't count twice. Not on your own review, not by the
// product's own shop, and only by accounts that shop (admins and riders don't).
export async function voteReview(req, res) {
  const { vote } = req.body ?? {};
  if (!['up', 'down', 'none'].includes(vote)) throw invalid({ vote: 'Vote up, down or none.' });
  if (['admin', 'rider'].includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', 'Only shoppers can vote on reviews.');
  if (!isId(req.params.id)) throw notFound('That review');
  const review = await Review.findById(req.params.id).populate('product', 'seller');
  if (!review) throw notFound('That review');
  if (sameId(review.user, req.user)) throw new AppError(403, 'OWN_REVIEW', "You can't vote on your own review.");
  if (sameId(review.product?.seller, req.user)) {
    throw new AppError(403, 'OWN_PRODUCT', "Shops can't vote on reviews of their own products.");
  }
  const me = req.user._id;
  const without = (field) => ({ $setDifference: [{ $ifNull: [`$${field}`, []] }, [me]] });
  const add = (field) => ({ $concatArrays: [without(field), [me]] });
  const updated = await Review.findOneAndUpdate(
    { _id: review._id },
    [
      {
        $set: {
          helpful: vote === 'up' ? add('helpful') : without('helpful'),
          unhelpful: vote === 'down' ? add('unhelpful') : without('unhelpful'),
        },
      },
      { $set: { helpfulCount: { $size: '$helpful' } } },
    ],
    { new: true, updatePipeline: true },
  );
  res.json({ likes: updated.helpful.length, dislikes: updated.unhelpful.length, myVote: vote === 'none' ? null : vote });
}

export async function createReview(req, res) {
  const product = await Product.findById(req.params.id).select('_id');
  if (!product) throw notFound('That product');
  if (!(await hasDeliveredOrder(req.user._id, product._id))) {
    throw new AppError(403, 'FORBIDDEN', 'Only buyers with a delivered order can review this product.');
  }
  const review = await Review.create({ ...reviewInput(req.body), user: req.user._id, product: product._id });
  await claimUploads(review.images);
  res.status(201).json({ review });
}

export async function updateReview(req, res) {
  const before = isId(req.params.id) ? await Review.findOne({ _id: req.params.id, user: req.user._id }) : null;
  if (!before) throw notFound('That review');
  const data = reviewInput(req.body);
  const review = await Review.findOneAndUpdate({ _id: before._id, user: req.user._id }, data, {
    new: true,
    runValidators: true,
  });
  // Photos the buyer took off the review are deleted from storage.
  if (data.images) {
    await claimUploads(data.images);
    await dropFiles(before.images.filter((url) => !data.images.includes(url)));
  }
  res.json({ review });
}

// The shop's one public reply to a review, written or edited by the shop that sells the product. The first reply
// tells the reviewer.
async function reviewWithProduct(req) {
  const review = isId(req.params.id) ? await Review.findById(req.params.id).populate('product', 'seller name slug') : null;
  if (!review?.product) throw notFound('That review');
  return review;
}

export async function replyToReview(req, res) {
  const review = await reviewWithProduct(req);
  if (!sameId(review.product.seller, req.user)) throw notFound('That review');
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (body.length < 2) throw invalid({ body: 'Write a reply.' });
  if (body.length > 500) throw invalid({ body: 'Keep the reply under 500 characters.' });
  const first = !review.reply;
  const reply = first ? { body, at: new Date() } : { body, at: review.reply.at, editedAt: new Date() };
  await Review.updateOne({ _id: review._id }, { reply });
  if (first) {
    await notify({
      user: review.user,
      type: 'review',
      title: `${req.user.sellerProfile?.shopName ?? 'The shop'} replied to your review`,
      body: `On ${review.product.name}: "${body.slice(0, 200)}"`,
      link: `/p/${review.product.slug}#review-${review._id}`, // lands on the review itself
    });
  }
  res.json({ reply });
}

// The shop can take its reply down, and so can admins who moderate products.
export async function deleteReply(req, res) {
  const review = await reviewWithProduct(req);
  if (!sameId(review.product.seller, req.user) && !canManage(req.user, 'products')) throw notFound('That review');
  await Review.updateOne({ _id: review._id }, { $unset: { reply: 1 } });
  res.json({ deleted: true });
}

export async function deleteReview(req, res) {
  const review = await Review.findById(req.params.id).populate('product', 'name').populate('user', 'role');
  const own = review && sameId(review.user, req.user);
  const byAdmin = review?.user?.role === 'admin';
  if (!review || (!own && (!canManage(req.user, 'products') || (byAdmin && !req.user.isOwner)))) {
    throw notFound('That review');
  }
  if (own) {
    await Review.findOneAndDelete({ _id: review._id });
    await dropFiles(review.images);
    return res.json({ deleted: true });
  }
  await mongoose.connection.transaction(async (session) => {
    const copy = await Review.collection.findOne({ _id: review._id }, { session });
    await Review.deleteOne({ _id: review._id }, { session });
    await record(
      req.user,
      {
        action: 'review.delete',
        target: { kind: 'review', id: review._id, label: `"${review.title}" on ${review.product?.name ?? 'a product'}` },
        summary: `removed a ${review.rating}-star review of ${review.product?.name ?? 'a product'}`,
        undo: { review: copy },
      },
      session,
    );
  });
  await Review.calcRating(review.product._id);
  res.json({ deleted: true });
}

// Every review on the shop's own products, for its Seller Center inbox. `?needs=reply` keeps the ones the shop
// hasn't answered; the counts cover both tabs.
export async function shopReviews(req, res) {
  const products = await Product.distinct('_id', { seller: req.user._id });
  const all = { product: { $in: products } };
  const unanswered = { ...all, reply: { $exists: false } };
  const [page, total, needsReply] = await Promise.all([
    paginate(Review, req.query.needs === 'reply' ? unanswered : all, pageParams(req.query, { defaultLimit: 10 }), (q) =>
      q.sort({ createdAt: -1 }).populate('user', 'name').populate('product', 'name slug images'),
    ),
    Review.countDocuments(all),
    Review.countDocuments(unanswered),
  ]);
  res.json({ ...page, counts: { all: total, needsReply } });
}
