import mongoose from 'mongoose';

export const CATEGORIES = ['keyboard', 'mouse', 'headset', 'webcam', 'mousepad', 'accessory'];
export const RESOLUTIONS = ['720p', '1080p', '1440p', '4k'];
export const CONNECTIVITY = ['wired', 'wireless', 'bluetooth', 'tri-mode'];
export const SWITCH_TYPES = ['linear', 'tactile', 'clicky', 'magnetic'];
export const LAYOUTS = ['full', 'tkl', '75', '65', '60'];

const isInteger = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: [true, 'Image URL is required'], trim: true },
    publicId: { type: String, trim: true }, // Cloudinary id, used to delete the file later
    alt: {
      type: String,
      required: [true, 'Alt text is required'],
      trim: true,
      maxlength: [120, 'Alt text must be at most 120 characters'],
    },
  },
  { _id: false }
);

// Every spec is optional: a mouse has no layout, a keyboard has no DPI.
const specsSchema = new mongoose.Schema(
  {
    connectivity: { type: String, enum: { values: CONNECTIVITY, message: '{VALUE} is not a valid connectivity' } },
    switchType: { type: String, enum: { values: SWITCH_TYPES, message: '{VALUE} is not a valid switch type' } },
    layout: { type: String, enum: { values: LAYOUTS, message: '{VALUE} is not a valid layout' } },
    pollingRateHz: { type: Number, min: [125, 'Polling rate must be at least 125 Hz'], max: [8000, 'Polling rate must be at most 8000 Hz'], validate: isInteger },
    dpiMax: { type: Number, min: [100, 'DPI must be at least 100'], max: [50000, 'DPI must be at most 50000'], validate: isInteger },
    weightGrams: { type: Number, min: [1, 'Weight must be at least 1 g'], max: [5000, 'Weight must be at most 5000 g'] },
    sensor: { type: String, trim: true, maxlength: [40, 'Sensor must be at most 40 characters'] },
    batteryMah: { type: Number, min: [0, 'Battery cannot be negative'], validate: isInteger },
    resolution: { type: String, enum: { values: RESOLUTIONS, message: '{VALUE} is not a valid resolution' } },
    fps: { type: Number, min: [15, 'Frame rate must be at least 15 fps'], max: [120, 'Frame rate must be at most 120 fps'], validate: isInteger },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // Set from req.user in the controller, never from req.body.
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [120, 'Product name must be at most 120 characters'],
    },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      minlength: [2, 'Brand must be at least 2 characters'],
      maxlength: [40, 'Brand must be at most 40 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: '{VALUE} is not a valid category' },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    // Integer cents avoid floating-point rounding (0.1 + 0.2 !== 0.3).
    priceCents: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: isInteger,
    },
    // A sale: the regular price, shown struck through next to priceCents (what the customer pays).
    // Checkout, codes, sorting and price filters all use priceCents, so a sale needs nothing else.
    compareAtCents: {
      type: Number,
      validate: [
        isInteger,
        {
          validator(value) {
            return value == null || value > this.priceCents;
          },
          message: 'The regular price must be higher than the sale price',
        },
      ],
    },
    // Every change to the regular price (compareAtCents during a sale, otherwise priceCents), so a sale
    // can't claim a "was" price the product never really had. Trimmed to about 30 days.
    priceLog: {
      type: [{ _id: false, cents: { type: Number, required: true }, at: { type: Date, required: true } }],
      select: false,
      default: undefined,
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      validate: isInteger,
    },
    specs: { type: specsSchema, default: () => ({}) },
    images: {
      type: [imageSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 6,
        message: 'A product needs 1 to 6 images',
      },
    },
    modelUrl: { type: String, trim: true }, // optional .glb for the 3D carousel
    isFeatured: { type: Boolean, default: false }, // admin-only
    isActive: { type: Boolean, default: true },
    // Who unlisted it. A seller can't relist a product the admin took down.
    unlistedBy: {
      type: String,
      enum: { values: ['seller', 'admin'], message: '{VALUE} is not a valid value' },
      default: undefined,
    },
    // Denormalized from Review. Only Review.calcRating writes these.
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.priceLog;
        return ret;
      },
    },
  }
);

productSchema.index({ name: 'text', brand: 'text' });
productSchema.index({ category: 1, priceCents: 1 });
productSchema.index({ seller: 1, isActive: 1 });
productSchema.index({ isFeatured: 1 });
// The shop grid: active products newest first, overall and per category. The trailing _id matches the
// sort's tie-breaker; without it Mongo can't walk the index in order and sorts every match in memory.
productSchema.index({ isActive: 1, createdAt: -1, _id: -1 });
productSchema.index({ isActive: 1, category: 1, createdAt: -1, _id: -1 });
// Brand list returned with every shop page (distinct over active products), answered from the index alone.
productSchema.index({ isActive: 1, brand: 1 });

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Generated once. Two sellers can list "Aster 75", so the id suffix keeps slugs unique.
productSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = `${slugify(this.name)}-${this._id.toString().slice(-6)}`;
  }
});

export default mongoose.model('Product', productSchema);
