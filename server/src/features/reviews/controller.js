import mongoose from 'mongoose';
import { Order, Product, ReturnRequest, Review } from '../../models/index.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { isId, pageParams, paginate, pick, sameId } from '../../lib/request.js';
import { canManage } from '../../middleware/auth.js';
import { record } from '../activity/service.js';

const FIELDS = ['rating', 'title', 'body'];

const hasDeliveredOrder = (userId, productId) =>
  Order.exists({ user: userId, status: 'delivered', 'items.product': productId });

export async function listReviews(req, res) {
  if (!isId(req.params.id)) throw notFound('That product');
  const product = req.params.id;
  const result = await paginate(Review, { product }, pageParams(req.query, { defaultLimit: 10 }), (q) =>
    q.sort({ createdAt: -1 }).populate('user', 'name'),
  );

  const returnedBy = new Set(
    (
      await ReturnRequest.distinct('user', {
        status: 'refunded',
        'items.product': product,
        user: { $in: result.items.map((r) => r.user?._id).filter(Boolean) },
      })
    ).map(String),
  );
  result.items = result.items.map((r) => ({ ...r.toJSON(), returned: returnedBy.has(String(r.user?._id)) }));
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
  res.json({ ...result, canReview, myReviewId });
}

export async function createReview(req, res) {
  const product = await Product.findById(req.params.id).select('_id');
  if (!product) throw notFound('That product');
  if (!(await hasDeliveredOrder(req.user._id, product._id))) {
    throw new AppError(403, 'FORBIDDEN', 'Only buyers with a delivered order can review this product.');
  }
  const review = await Review.create({ ...pick(req.body, FIELDS), user: req.user._id, product: product._id });
  res.status(201).json({ review });
}

export async function updateReview(req, res) {
  const review = await Review.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, pick(req.body, FIELDS), {
    new: true,
    runValidators: true,
  });
  if (!review) throw notFound('That review');
  res.json({ review });
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
