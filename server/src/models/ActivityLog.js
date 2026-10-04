import mongoose from 'mongoose';

// One entry per admin or owner action, written in the same transaction as the action itself.
// Only the owner can undo an entry; admins can read the log.
export const ACTIVITY_ACTIONS = [
  'user.deactivate',
  'user.activate',
  'user.delete',
  'user.promote',
  'user.demote',
  'user.permissions',
  'user.reset-email',
  'seller.approve',
  'seller.suspend',
  'product.moderate',
  'order.cancel',
  'review.delete',
  'return.decide',
  'coupon.create',
  'coupon.update',
];
export const ACTIVITY_TARGETS = ['user', 'seller', 'product', 'order', 'coupon', 'review', 'return'];

const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Copied so the entry still reads right after the actor's account changes or is deleted.
    actorName: { type: String, required: true },
    action: { type: String, required: true, enum: { values: ACTIVITY_ACTIONS, message: '{VALUE} is not an action' } },
    target: {
      kind: { type: String, required: true, enum: ACTIVITY_TARGETS },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      label: { type: String, required: true },
    },
    summary: { type: String, required: true, maxlength: 300 },
    // What undoing needs: the values before and after, and anything the action removed.
    // A deleted account's snapshot includes its password hash, so this is never sent to the client.
    undo: { type: mongoose.Schema.Types.Mixed, select: false },
    undoable: { type: Boolean, default: true },
    undoneAt: Date,
    undoneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    undoneByName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1, _id: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1, _id: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
