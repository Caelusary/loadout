import mongoose from 'mongoose';

// What counts as a return: a fault with the item or the listing. Changing your mind doesn't.
export const RETURN_REASONS = ['damaged', 'wrong-item', 'not-as-described'];
// requested → approved (seller) → refunded (seller receives the item back)
// requested → declined (seller) → escalated (customer) → approved or closed (admin, final)
export const RETURN_STATUSES = ['requested', 'approved', 'declined', 'escalated', 'refunded', 'closed'];
export const RETURN_WINDOW_DAYS = 7;

const isInteger = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true }, // copied from the order line
    qty: { type: Number, required: true, min: [1, 'Return at least one'], validate: isInteger },
    // The line's price less its share of any discount code (rounded up), so a refund never exceeds what was paid.
    refundCents: { type: Number, required: true, min: 0, validate: isInteger },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: RETURN_STATUSES, required: true },
    by: { type: String, enum: ['customer', 'seller', 'admin'], required: true },
    note: { type: String, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [returnItemSchema],
      validate: { validator: (arr) => arr.length >= 1, message: 'Choose at least one item to return' },
    },
    reason: {
      type: String,
      required: [true, 'Choose a reason'],
      enum: { values: RETURN_REASONS, message: 'Returns are for damaged, wrong or not-as-described items' },
    },
    details: {
      type: String,
      required: [true, 'Describe the problem'],
      trim: true,
      minlength: [10, 'Describe the problem in at least 10 characters'],
      maxlength: [1000, 'Keep it under 1000 characters'],
    },
    status: { type: String, enum: RETURN_STATUSES, default: 'requested' },
    refundCents: { type: Number, required: true, min: 0, validate: isInteger },
    history: { type: [historySchema], default: () => [{ status: 'requested', by: 'customer' }] },
  },
  { timestamps: true }
);

returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ user: 1, createdAt: -1, _id: -1 });
returnRequestSchema.index({ seller: 1, status: 1, createdAt: -1, _id: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1, _id: -1 });

export default mongoose.model('ReturnRequest', returnRequestSchema);
