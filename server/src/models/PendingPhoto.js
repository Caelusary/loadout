import mongoose from 'mongoose';

// A photo uploaded for a review or a delivery that hasn't been attached to one yet. Posting the review (or marking
// the order delivered) claims it; one still unclaimed a day later is deleted with its file, so photos from a review
// that was never posted don't pile up in storage. The review form warns about this.
const pendingPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, required: true, enum: ['review', 'proof'] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

pendingPhotoSchema.index({ createdAt: 1 });

export default mongoose.model('PendingPhoto', pendingPhotoSchema);
