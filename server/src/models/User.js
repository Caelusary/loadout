import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { addressSchema } from './address.js';

export const ROLES = ['customer', 'seller', 'admin'];
export const SELLER_STATUSES = ['pending', 'approved', 'suspended'];
// The parts of the admin panel the owner can give or take from each admin. The dashboard is always open.
export const ADMIN_AREAS = ['users', 'sellers', 'products', 'orders', 'coupons'];

const sellerProfileSchema = new mongoose.Schema(
  {
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      minlength: [3, 'Shop name must be at least 3 characters'],
      maxlength: [40, 'Shop name must be at most 40 characters'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and dashes'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio must be at most 500 characters'],
    },
    logoUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: { values: SELLER_STATUSES, message: '{VALUE} is not a valid seller status' },
      default: 'pending',
    },
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
  },
  { _id: false }
);

const cartLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [10, 'You can order at most 10 of one item'],
      validate: { validator: Number.isInteger, message: 'Quantity must be a whole number' },
    },
    // The price when it was added, only to tell the shopper it has changed since. Checkout always uses the live price.
    priceCents: { type: Number, min: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email must be at most 254 characters'],
      // Domain labels can't contain dots, so the pattern can't backtrack quadratically on long input.
      match: [/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // bcrypt only reads the first 72 bytes, so anything longer would be silently cut.
      // Counted in bytes, not characters: an accented letter or emoji takes 2 to 4.
      validate: {
        validator: (v) => Buffer.byteLength(v, 'utf8') <= 72,
        message: 'Password is too long. Accented letters and emoji count as more than one character.',
      },
      select: false, // never returned unless a query asks for it with .select('+password')
    },
    // Never set from req.body. Only the admin's approve-seller action sets 'seller';
    // only the owner makes or removes admins.
    role: {
      type: String,
      enum: { values: ROLES, message: '{VALUE} is not a valid role' },
      default: 'customer',
    },
    isActive: { type: Boolean, default: true },
    // One entry per signed-in device. The cookie's token names its session, so signing out ends just
    // that one, and a password change ends every other. Capped at the 10 newest.
    sessions: {
      type: [{ _id: false, id: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
      select: false,
      default: [],
    },
    // A pending "forgot password" link: only a hash of its token, when it was sent, and when it stops working.
    passwordReset: {
      type: new mongoose.Schema({ tokenHash: String, sentAt: Date, expiresAt: Date }, { _id: false }),
      select: false,
    },
    // The one account above every admin: it manages admins, and no admin can change it. Set only by the seed.
    isOwner: { type: Boolean, default: false },
    // Admins only: which areas this admin may manage. The owner always has all of them.
    adminPermissions: {
      type: [{ type: String, enum: { values: ADMIN_AREAS, message: '{VALUE} is not an admin area' } }],
      default: undefined,
    },
    shippingAddress: addressSchema,
    sellerProfile: sellerProfileSchema, // present only once the user applies to sell
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      validate: { validator: (arr) => arr.length <= 100, message: 'A wishlist can hold at most 100 products' },
    },
    // Only signed-in shoppers have a cart, so it lives on the account: the same cart on every device.
    // Names, prices and stock are always read fresh from the product, never stored here.
    cart: {
      type: [cartLineSchema],
      validate: { validator: (arr) => arr.length <= 50, message: 'A cart can hold at most 50 different products' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.cart; // served by /api/cart
        delete ret.sessions;
        delete ret.passwordReset;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique shop slugs, but only among users that have a seller profile.
userSchema.index(
  { 'sellerProfile.slug': 1 },
  { unique: true, partialFilterExpression: { 'sellerProfile.slug': { $exists: true } } }
);
userSchema.index({ role: 1, 'sellerProfile.status': 1 });
userSchema.index({ 'passwordReset.tokenHash': 1 }, { sparse: true });
// At most one owner.
userSchema.index({ isOwner: 1 }, { unique: true, partialFilterExpression: { isOwner: true } });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.virtual('isApprovedSeller').get(function () {
  return this.role === 'seller' && this.sellerProfile?.status === 'approved';
});

export default mongoose.model('User', userSchema);
