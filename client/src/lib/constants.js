// Mirrors the enums in server/src/models. Keep both sides in sync.
export const CATEGORIES = ['keyboard', 'mouse', 'headset', 'webcam', 'mousepad', 'accessory'];
export const CONNECTIVITY = ['wired', 'wireless', 'bluetooth', 'tri-mode'];
export const SWITCH_TYPES = ['linear', 'tactile', 'clicky', 'magnetic'];
export const LAYOUTS = ['full', 'tkl', '75', '65', '60'];
export const RESOLUTIONS = ['720p', '1080p', '1440p', '4k'];
export const ORDER_STATUSES = ['placed', 'processing', 'shipped', 'out-for-delivery', 'delivered', 'cancelled'];
export const PAYMENT_METHODS = ['cod', 'mock-gcash', 'mock-card'];

export const CATEGORY_LABELS = {
  keyboard: 'Keyboards',
  mouse: 'Mice',
  headset: 'Headsets',
  webcam: 'Webcams',
  mousepad: 'Mousepads',
  accessory: 'Accessories',
};
export const CATEGORY_SINGULAR = {
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  headset: 'Headset',
  webcam: 'Webcam',
  mousepad: 'Mousepad',
  accessory: 'Accessory',
};
export const CONNECTIVITY_LABELS = { wired: 'Wired', wireless: 'Wireless', bluetooth: 'Bluetooth', 'tri-mode': 'Tri-mode' };
export const SWITCH_LABELS = { linear: 'Linear', tactile: 'Tactile', clicky: 'Clicky', magnetic: 'Magnetic' };
export const LAYOUT_LABELS = { full: 'Full size', tkl: 'TKL', 75: '75%', 65: '65%', 60: '60%' };
export const RESOLUTION_LABELS = { '720p': '720p', '1080p': '1080p', '1440p': '1440p', '4k': '4K' };
export const PAYMENT_LABELS = { cod: 'Cash on delivery', 'mock-gcash': 'GCash (simulated)', 'mock-card': 'Card (simulated)' };
export const STATUS_LABELS = {
  placed: 'Placed',
  processing: 'Processing',
  shipped: 'Waiting for pickup',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Same map as server/src/features/products/service.js
export const SPEC_FIELDS = {
  keyboard: ['connectivity', 'switchType', 'layout', 'pollingRateHz', 'weightGrams', 'batteryMah'],
  mouse: ['connectivity', 'sensor', 'dpiMax', 'pollingRateHz', 'weightGrams', 'batteryMah'],
  headset: ['connectivity', 'weightGrams', 'batteryMah'],
  webcam: ['connectivity', 'resolution', 'fps'],
  mousepad: ['weightGrams'],
  accessory: ['connectivity'],
};

// Display only; server/src/features/orders/shipping.js decides what is charged.
export const SHIPPING_FEE_CENTS = 15000;
export const FREE_SHIPPING_MIN_CENTS = 300000;
export const shippingFor = (subtotalCents) => (subtotalCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_FEE_CENTS);

export const MAX_QTY = 10;
export const MAX_COMPARE = 3;

// Returns: what counts, how long after delivery, and when an unconfirmed order completes itself.
export const RETURN_REASONS = [
  { value: 'damaged', label: 'Damaged or defective', description: "Arrived broken or doesn't work." },
  { value: 'wrong-item', label: 'Wrong item', description: 'A different model, color or switch than ordered.' },
  { value: 'not-as-described', label: 'Not as described', description: "The specs don't match the listing." },
];
export const RETURN_WINDOW_DAYS = 7;
export const AUTO_DELIVER_DAYS = 7;

// The admin panel areas the owner hands out, with their labels.
export const ADMIN_AREA_LABELS = { users: 'Users', sellers: 'Sellers', products: 'Products', orders: 'Orders', coupons: 'Discount codes' };

// A declined seller applicant may apply again this long after the decision.
export const REAPPLY_WAIT_MS = 7 * 24 * 60 * 60 * 1000;

// Cache-buster on the bundled product photos; matches PHOTO_VERSION in server/src/seed/data.js.
export const PHOTO_VERSION = 9;

// Riders. Mirrors server/src/models/User.js, Order.js and RiderFeedback.js (constants-sync.test.js checks).
export const VEHICLE_LABELS = { motorcycle: 'Motorcycle', bicycle: 'Bicycle', car: 'Car', van: 'Van' };
export const DECLINE_REASON_LABELS = {
  'too-far': 'Too far from my route',
  'vehicle-problem': 'Vehicle problem',
  unavailable: "I'm not available",
  other: 'Something else',
};
// Why a rider couldn't hand an order over (Order.attempts). After MAX_ATTEMPTS misses it goes back to the shop.
export const ATTEMPT_REASON_LABELS = {
  'not-home': 'Buyer not home',
  'wrong-address': "Couldn't find the address",
  refused: 'Buyer refused it',
};
export const MAX_ATTEMPTS = 2;
export const RIDER_REPORT_LABELS = {
  unsafe: 'Unsafe driving or handling',
  harassment: 'Harassment or unwanted contact',
  'asked-for-money': 'Asked for extra money',
  rude: 'Rude or threatening',
  other: 'Something else',
};

// The next step each side can move an order to, and its button. The shop's part ends at shipped ("Waiting for
// pickup"); the rider takes it from there.
export const SHOP_NEXT = { placed: 'processing', processing: 'shipped' };
export const SHOP_NEXT_LABEL = { processing: 'Start processing', shipped: 'Ready for pickup' };
export const RIDER_NEXT = { shipped: 'out-for-delivery', 'out-for-delivery': 'delivered' };
// Actions, not statuses: what the rider is doing when they tap it.
export const RIDER_NEXT_LABEL = { 'out-for-delivery': 'Start delivery', delivered: 'Mark delivered' };

// Photos on one review.
export const MAX_REVIEW_PHOTOS = 3;
