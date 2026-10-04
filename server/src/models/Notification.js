import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['order', 'seller', 'review', 'account'];

// In-app notices (there is no email). Created by the server when something happens to a user's orders or shop.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: { values: NOTIFICATION_TYPES, message: '{VALUE} is not a valid notification type' },
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 300 },
    link: { type: String, trim: true }, // an in-app path, like /orders/<id>
    readAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
