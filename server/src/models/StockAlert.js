import mongoose from 'mongoose';

// "Notify me when it's back": one per shopper per sold-out product. Removed once the shopper has been told.
const stockAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });
stockAlertSchema.index({ product: 1 });

export default mongoose.model('StockAlert', stockAlertSchema);
