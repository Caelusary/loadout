import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [80, 'Title must be at most 80 characters'],
    },
    body: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      minlength: [10, 'Review must be at least 10 characters'],
      maxlength: [1000, 'Review must be at most 1000 characters'],
    },
  },
  { timestamps: true }
);

// One review per product per user. A second attempt fails with duplicate key 11000 -> 409.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

// The verified-buyer rule (a delivered order containing this product) lives in the controller,
// because it needs the Order collection.

reviewSchema.statics.calcRating = async function (productId) {
  const [stats] = await this.aggregate([
    { $match: { product: productId } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await mongoose.model('Product').findByIdAndUpdate(productId, {
    ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
    ratingCount: stats ? stats.count : 0,
  });
};

reviewSchema.post('save', async function () {
  await this.constructor.calcRating(this.product);
});

// Editing or deleting a review goes through these query methods, so recalc after them too.
reviewSchema.post(['findOneAndUpdate', 'findOneAndDelete'], async function (doc) {
  if (doc) await doc.constructor.calcRating(doc.product);
});

export default mongoose.model('Review', reviewSchema);
