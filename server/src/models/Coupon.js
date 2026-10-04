import mongoose from 'mongoose';

export const COUPON_TYPES = ['percent', 'fixed'];

const isInteger = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

// A checkout-wide discount code. Each customer can use a code once; the server computes the discount.
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{4,20}$/, 'Codes are 4 to 20 letters or numbers'],
    },
    type: {
      type: String,
      required: true,
      enum: { values: COUPON_TYPES, message: '{VALUE} is not a valid discount type' },
    },
    // percent: 1-90 (percent off); fixed: centavos off.
    value: { type: Number, required: [true, 'Value is required'], min: [1, 'Value must be at least 1'], validate: isInteger },
    minSubtotalCents: { type: Number, min: 0, default: 0, validate: isInteger },
    maxUses: { type: Number, min: 1, validate: isInteger }, // unset means unlimited
    usedCount: { type: Number, min: 0, default: 0, validate: isInteger },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.pre('validate', function () {
  if (this.type === 'percent' && this.value > 90) this.invalidate('value', 'A percent discount can be at most 90');
  // Catches a typo like an extra zero before it makes every cart free.
  if (this.type === 'fixed' && this.value > 5000000) this.invalidate('value', 'A fixed discount can be at most ₱50,000');
});

export default mongoose.model('Coupon', couponSchema);
