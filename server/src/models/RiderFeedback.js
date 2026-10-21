import mongoose from 'mongoose';

// Why a buyer reported a rider. Any report pauses the rider from new deliveries until an admin looks.
export const RIDER_REPORT_REASONS = ['unsafe', 'harassment', 'asked-for-money', 'rude', 'other'];

// What a buyer said about the rider on one order: a 1-5 rating once they've confirmed it arrived, a report about
// the rider's behaviour, or both. One per order and rider. Riders see their average and count, never who said what.
const riderFeedbackSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the buyer
    stars: {
      type: Number,
      min: [1, 'Pick 1 to 5 stars'],
      max: [5, 'Pick 1 to 5 stars'],
      validate: { validator: (v) => v == null || Number.isInteger(v), message: 'Pick 1 to 5 stars' },
    },
    comment: { type: String, trim: true, maxlength: [300, 'Keep it under 300 characters'] },
    report: {
      type: new mongoose.Schema(
        {
          reason: {
            type: String,
            required: true,
            enum: { values: RIDER_REPORT_REASONS, message: '{VALUE} is not a reason' },
          },
          note: {
            type: String,
            trim: true,
            required: [true, 'Tell us what happened'],
            maxlength: [500, 'Keep it under 500 characters'],
          },
          at: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // The rider's side of a report, written once before an admin decides. Admins read it next to the buyer's; the
    // buyer never sees it.
    riderReply: {
      type: new mongoose.Schema(
        {
          text: { type: String, trim: true, required: true, maxlength: [500, 'Keep it under 500 characters'] },
          at: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // Ratings of 2 stars or less and every report go to the admins' review queue until someone marks them reviewed.
    flagged: { type: Boolean, default: false },
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

riderFeedbackSchema.pre('validate', function () {
  // A comment alone is not a reason: praise like "quick and polite" has nothing for an admin to do.
  this.flagged = Boolean(this.report || (this.stars && this.stars <= 2));
});

// One per order and rider: an order a reported rider never picked up goes to someone the buyer can rate too.
riderFeedbackSchema.index({ order: 1, rider: 1 }, { unique: true });
riderFeedbackSchema.index({ rider: 1, createdAt: -1 });
riderFeedbackSchema.index({ flagged: 1, reviewedAt: 1, createdAt: -1 });

export default mongoose.model('RiderFeedback', riderFeedbackSchema);
