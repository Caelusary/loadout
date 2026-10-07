import mongoose from 'mongoose';
import { addressSchema } from './address.js';

export const ORDER_STATUSES = ['placed', 'processing', 'shipped', 'out-for-delivery', 'delivered', 'cancelled'];
export const PAYMENT_METHODS = ['cod', 'mock-card'];

// Forward-only. The seller takes an order up to 'shipped' (handing it to a rider); the rider takes it
// out for delivery and marks it delivered. Customers may only cancel while 'placed'; the admin may
// cancel anything not yet delivered.
export const TRANSITIONS = {
  placed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out-for-delivery', 'delivered'],
  'out-for-delivery': ['delivered'],
  delivered: [],
  cancelled: [],
};
export const SELLER_STEPS = ['processing', 'shipped'];
export const RIDER_STEPS = ['out-for-delivery', 'delivered'];
// With a rider: handed over, not yet delivered.
export const ON_THE_WAY = ['shipped', 'out-for-delivery'];

const isInteger = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

// name, priceCents and image are snapshots taken at checkout,
// so editing the product later doesn't rewrite order history.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    priceCents: { type: Number, required: true, min: 0, validate: isInteger },
    qty: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [10, 'You can order at most 10 of one item'],
      validate: isInteger,
    },
    image: { type: String, trim: true },
  },
  { _id: false }
);

// One entry per status change, so the order page can show when each step happened.
const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the customer
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the shop
    checkoutId: { type: String, required: true }, // shared by all orders from one checkout
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'An order needs at least one item',
      },
    },
    shippingAddress: {
      type: addressSchema,
      required: [true, 'Shipping address is required'],
    },
    subtotalCents: { type: Number, min: 0, validate: isInteger },
    shippingCents: { type: Number, required: true, min: 0, default: 0, validate: isInteger },
    // This order's share of a checkout-wide discount code; set by the server at checkout.
    discountCents: { type: Number, min: 0, default: 0, validate: isInteger },
    couponCode: { type: String, trim: true, uppercase: true },
    totalCents: { type: Number, min: 0, validate: isInteger },
    status: {
      type: String,
      enum: { values: ORDER_STATUSES, message: '{VALUE} is not a valid order status' },
      default: 'placed',
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: { values: PAYMENT_METHODS, message: '{VALUE} is not a valid payment method' },
    },
    cancelledBy: { type: String, enum: ['customer', 'seller', 'admin'] },
    // Why, when it wasn't the customer's own choice (a suspended shop, a closed account).
    cancelReason: { type: String, maxlength: 200 },
    // Assigned when the seller marks the order shipped: the rider who takes it out and marks it delivered.
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // The rider marks delivered, or it completes itself 7 days after shipping. 'seller' and 'customer'
    // are from before riders, when either side could mark it.
    deliveredBy: { type: String, enum: ['rider', 'auto', 'seller', 'customer'] },
    // Sum of refunds from approved returns that the seller has received back.
    refundedCents: { type: Number, min: 0, default: 0, validate: { validator: Number.isInteger, message: 'Must be whole centavos' } },
    statusHistory: { type: [statusEventSchema], default: () => [{ status: 'placed' }] },
  },
  { timestamps: true }
);

// Every list sorts { createdAt: -1, _id: -1 }, so each list index ends in _id to serve that sort directly.
orderSchema.index({ user: 1, createdAt: -1, _id: -1 });
orderSchema.index({ seller: 1, status: 1, createdAt: -1, _id: -1 });
// One order per shop per checkout. The client sends the same checkoutId when it retries, so this is
// what stops a resent request from placing the order twice.
orderSchema.index({ checkoutId: 1, seller: 1 }, { unique: true });
// Admin order list (newest first, no filter) and a seller's orders when no status is picked, incl. their stats.
orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.index({ seller: 1, createdAt: -1, _id: -1 });
// Admin list filtered by status, and the hourly auto-deliver sweep over shipped orders.
orderSchema.index({ status: 1, createdAt: -1, _id: -1 });
// A rider's deliveries page, and picking the least busy rider when an order ships.
orderSchema.index({ rider: 1, status: 1, createdAt: -1, _id: -1 });

// Totals are always computed here, never taken from the client.
orderSchema.pre('validate', function () {
  this.subtotalCents = this.items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  this.totalCents = Math.max(0, this.subtotalCents + (this.shippingCents ?? 0) - (this.discountCents ?? 0));
});

orderSchema.methods.canTransitionTo = function (next) {
  return TRANSITIONS[this.status].includes(next);
};

export default mongoose.model('Order', orderSchema);
