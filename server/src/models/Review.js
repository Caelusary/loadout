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
    // Photos the buyer attached: stored files from the review uploader, at most 3.
    images: {
      type: [String],
      default: [],
      validate: { validator: (arr) => arr.length <= 3, message: 'You can add up to 3 photos' },
    },
    // The shop's public answer. One per review, which the shop can edit or remove, so a review never turns into a thread.
    reply: {
      type: new mongoose.Schema(
        {
          body: {
            type: String,
            required: [true, 'Write a reply'],
            trim: true,
            minlength: [2, 'Write a reply'],
            maxlength: [500, 'Keep the reply under 500 characters'],
          },
          at: { type: Date, default: Date.now },
          editedAt: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },
    // Other shoppers' votes: one per person, either way. The lists stay on the server (only the counts and your own
    // vote are sent); helpfulCount mirrors helpful's length so "Most helpful" can sort on an index.
    helpful: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    unhelpful: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    helpfulCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    // Who voted is nobody else's business: the vote lists never leave the server.
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.helpful;
        delete ret.unhelpful;
        return ret;
      },
    },
  }
);

// One review per product per user. A second attempt fails with duplicate key 11000 -> 409.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ product: 1, helpfulCount: -1, createdAt: -1 });

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
