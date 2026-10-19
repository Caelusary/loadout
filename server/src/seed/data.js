import mongoose from 'mongoose';

// Fixed ids keep slugs, product shots (client/public/products) and links stable across reseeds.
const id = (prefix, n) => new mongoose.Types.ObjectId(`${prefix}${String(n).padStart(24 - prefix.length, '0')}`);

const address = (fullName, line1, city, province, postalCode, phone) => ({
  fullName,
  line1,
  city,
  province,
  postalCode,
  phone,
});

export const users = {
  owner: { _id: id('a1', 11), name: 'Zachary Scott Ruiz', email: 'owner@loadout.test', role: 'admin', isOwner: true },
  admin: {
    _id: id('a1', 1),
    name: 'Rhea Santos',
    email: 'admin@loadout.test',
    role: 'admin',
    adminPermissions: ['users', 'sellers', 'products', 'orders', 'coupons'],
  },
  northpaw: {
    _id: id('a1', 2),
    name: 'Nico Bautista',
    email: 'northpaw@loadout.test',
    role: 'seller',
    sellerProfile: {
      shopName: 'Northpaw Keys',
      slug: 'northpaw-keys',
      bio: 'Small-batch mechanical keyboards and desk accessories, assembled and tested in Quezon City.',
      status: 'approved',
    },
  },
  glide: {
    _id: id('a1', 3),
    name: 'Andrea Lim',
    email: 'glide@loadout.test',
    role: 'seller',
    sellerProfile: {
      shopName: 'Glide Lab',
      slug: 'glide-lab',
      bio: 'Lightweight mice and mousepads tuned for aim, with every sensor tested before it ships.',
      status: 'approved',
    },
  },
  hush: {
    _id: id('a1', 4),
    name: 'Jun Castillo',
    email: 'hush@loadout.test',
    role: 'seller',
    sellerProfile: {
      shopName: 'Hush Audio',
      slug: 'hush-audio',
      bio: 'Headsets and webcams for long calls and late sessions. Comfortable first, loud second.',
      status: 'approved',
    },
  },
  lumen: {
    _id: id('a1', 9),
    name: 'Bea Navarro',
    email: 'lumen@loadout.test',
    role: 'seller',
    sellerProfile: {
      shopName: 'Lumen Desk',
      slug: 'lumen-desk',
      bio: 'Light, stands and soft goods for the rest of the desk: the things that make a setup feel finished.',
      status: 'approved',
    },
  },
  coilworks: {
    _id: id('a1', 5),
    name: 'Carlo Dizon',
    email: 'coilworks@loadout.test',
    role: 'customer',
    sellerProfile: {
      shopName: 'Coilworks',
      slug: 'coilworks',
      bio: 'Custom coiled USB-C cables in paracord sleeving, made to order.',
      status: 'pending',
    },
  },
  mika: {
    _id: id('a1', 6),
    name: 'Mika Reyes',
    email: 'mika@loadout.test',
    role: 'customer',
    shippingAddress: address('Mika Reyes', 'Unit 12B, 88 Kalayaan Ave', 'Quezon City', 'Metro Manila', '1101', '09171234567'),
  },
  paolo: {
    _id: id('a1', 7),
    name: 'Paolo Cruz',
    email: 'paolo@loadout.test',
    role: 'customer',
    shippingAddress: address('Paolo Cruz', '41 Mabini St, Brgy. San Roque', 'Marikina', 'Metro Manila', '1801', '09285551094'),
  },
  lea: {
    _id: id('a1', 8),
    name: 'Lea Villanueva',
    email: 'lea@loadout.test',
    role: 'customer',
    shippingAddress: address('Lea Villanueva', '9 Gen. Luna St', 'Cebu City', 'Cebu', '6000', '09391827364'),
  },
  // Delivery riders. Dispatch weighs rating against how many orders each has on the way. Ramon and Joy carry the
  // seeded deliveries; Dante shows the low-rating alert and Rico a report that paused him (see riderStory below).
  ramon: {
    _id: id('a1', 12), name: 'Ramon Aquino', email: 'ramon@loadout.test', role: 'rider',
    riderProfile: { phone: '09171112233', vehicle: 'motorcycle', plate: 'NAB 4821' },
  },
  joy: {
    _id: id('a1', 13), name: 'Joy Ramos', email: 'joy@loadout.test', role: 'rider',
    riderProfile: { phone: '09184445566', vehicle: 'motorcycle', plate: 'DAQ 1937' },
  },
  dante: {
    _id: id('a1', 14), name: 'Dante Lim', email: 'dante@loadout.test', role: 'rider',
    riderProfile: { phone: '09207778899', vehicle: 'bicycle' },
  },
  rico: {
    _id: id('a1', 15), name: 'Rico Mendoza', email: 'rico@loadout.test', role: 'rider',
    riderProfile: { phone: '09221234567', vehicle: 'car', plate: 'CBT 5520' },
  },
  // Earlier buyers (the first checkouts below): their orders are older than the dashboards' 60 days, so they add
  // reviews without changing any sales numbers.
  bea: { _id: id('a1', 16), name: 'Bea Santos', email: 'bea.santos@loadout.test', role: 'customer', shippingAddress: address('Bea Santos', '22 Shaw Blvd', 'Pasig', 'Metro Manila', '1600', '09175550101') },
  carlo: { _id: id('a1', 17), name: 'Carlo Dizon', email: 'carlo@loadout.test', role: 'customer', shippingAddress: address('Carlo Dizon', '5 Jupiter St, Bel-Air', 'Makati', 'Metro Manila', '1209', '09175550102') },
  jas: { _id: id('a1', 18), name: 'Jasmine Tan', email: 'jasmine@loadout.test', role: 'customer', shippingAddress: address('Jasmine Tan', '140 Boni Ave', 'Mandaluyong', 'Metro Manila', '1550', '09175550103') },
  miguel: { _id: id('a1', 19), name: 'Miguel Garcia', email: 'miguel@loadout.test', role: 'customer', shippingAddress: address('Miguel Garcia', '8 Quimpo Blvd', 'Davao City', 'Davao del Sur', '8000', '09175550104') },
  andrea: { _id: id('a1', 20), name: 'Andrea Flores', email: 'andrea@loadout.test', role: 'customer', shippingAddress: address('Andrea Flores', '31 Iznart St', 'Iloilo City', 'Iloilo', '5000', '09175550105') },
  josh: { _id: id('a1', 21), name: 'Josh Navarro', email: 'josh@loadout.test', role: 'customer', shippingAddress: address('Josh Navarro', '12 Lawton Ave', 'Taguig', 'Metro Manila', '1630', '09175550106') },
  nina: { _id: id('a1', 22), name: 'Nina Castillo', email: 'nina@loadout.test', role: 'customer', shippingAddress: address('Nina Castillo', '17 Session Rd', 'Baguio', 'Benguet', '2600', '09175550107') },
  rafael: { _id: id('a1', 23), name: 'Rafael Ong', email: 'rafael@loadout.test', role: 'customer', shippingAddress: address('Rafael Ong', '3 Sumulong Hwy', 'Antipolo', 'Rizal', '1870', '09175550108') },

};

// Bump when the product photos are re-rendered, so browsers fetch the new files instead of their
// cached copies. Mirrored in client/src/lib/constants.js; `npm run photos` updates a live database.
export const PHOTO_VERSION = 9;

// Three angles per product, rendered from its model (see client/scripts/shots.mjs).
const shot = (slug, name) => [
  { url: `/products/${slug}.webp?v=${PHOTO_VERSION}`, alt: `${name}, front three-quarter view` },
  { url: `/products/${slug}-2.webp?v=${PHOTO_VERSION}`, alt: `${name}, side view` },
  { url: `/products/${slug}-3.webp?v=${PHOTO_VERSION}`, alt: `${name}, view from above` },
];

const product = (n, seller, slug, fields) => ({
  _id: id('b2', n),
  seller: users[seller]._id,
  slug,
  images: shot(slug, fields.name),
  // Sketchfab models (credits in README), rotated to face front and compressed.
  modelUrl: `/products/models/${slug}.glb`,
  ...fields,
});

export const products = [
  product(1, 'northpaw', 'northpaw-aster-75-wireless', {
    name: 'Northpaw Aster 75 Wireless',
    brand: 'Northpaw',
    category: 'keyboard',
    description:
      'Gasket-mounted 75% board with hot-swap sockets, a 4000 mAh battery, and pre-lubed tactile switches. Connects over 2.4 GHz, Bluetooth, or USB-C.',
    priceCents: 649000,
    stock: 14,
    isFeatured: true,
    specs: { connectivity: 'tri-mode', switchType: 'tactile', layout: '75', pollingRateHz: 1000, weightGrams: 860, batteryMah: 4000 },
  }),
  product(2, 'northpaw', 'northpaw-tern-65', {
    name: 'Northpaw Tern 65',
    brand: 'Northpaw',
    category: 'keyboard',
    description: 'Compact 65% wired board with smooth linear switches and an 8000 Hz polling rate for competitive play.',
    priceCents: 485000,
    stock: 22,
    specs: { connectivity: 'wired', switchType: 'linear', layout: '65', pollingRateHz: 8000, weightGrams: 720 },
  }),
  product(3, 'northpaw', 'northpaw-halden-tkl', {
    name: 'Northpaw Halden TKL',
    brand: 'Northpaw',
    category: 'keyboard',
    description:
      'Tenkeyless board with magnetic Hall effect switches and per-key RGB. Set each key to actuate anywhere from 0.1 mm to 4.0 mm.',
    priceCents: 899000,
    stock: 6,
    isFeatured: true,
    specs: { connectivity: 'wired', switchType: 'magnetic', layout: 'tkl', pollingRateHz: 8000, weightGrams: 1120 },
  }),
  product(4, 'northpaw', 'northpaw-pip-60', {
    name: 'Northpaw Pip 60',
    brand: 'Northpaw',
    category: 'keyboard',
    description: 'A 60% starter board with crisp clicky switches and doubleshot PBT keycaps. Fits in a sling bag.',
    priceCents: 279000,
    compareAtCents: 329000, // on sale for the demo
    saleEndsAt: new Date(Date.now() + (2 * 24 + 5) * 60 * 60 * 1000), // shows the countdown
    stock: 31,
    specs: { connectivity: 'wired', switchType: 'clicky', layout: '60', pollingRateHz: 1000, weightGrams: 560 },
  }),
  product(5, 'northpaw', 'northpaw-ledger-full', {
    name: 'Northpaw Ledger Full',
    brand: 'Northpaw',
    category: 'keyboard',
    description: 'Full-size Bluetooth board with a number pad and quiet tactile switches, made for spreadsheets.',
    priceCents: 539000,
    stock: 4,
    specs: { connectivity: 'bluetooth', switchType: 'tactile', layout: 'full', pollingRateHz: 1000, weightGrams: 1350, batteryMah: 3000 },
  }),
  product(6, 'northpaw', 'northpaw-sable-65-wireless', {
    name: 'Northpaw Sable 65 Wireless',
    brand: 'Northpaw',
    category: 'keyboard',
    description: 'Aluminum 65% with a knob, tri-mode wireless, and tactile switches that stay quiet on calls.',
    priceCents: 595000,
    stock: 10,
    specs: { connectivity: 'tri-mode', switchType: 'tactile', layout: '65', pollingRateHz: 1000, weightGrams: 1480, batteryMah: 4000 },
  }),
  product(7, 'northpaw', 'northpaw-coiled-usb-c-cable', {
    name: 'Northpaw Coiled USB-C Cable',
    brand: 'Northpaw',
    category: 'accessory',
    description: 'Coiled cable in midnight-violet paracord with an aviator connector. 1.5 m, USB-C to USB-A.',
    priceCents: 89000,
    stock: 48,
    specs: { connectivity: 'wired' },
  }),
  product(8, 'northpaw', 'northpaw-numpad', {
    name: 'Northpaw Numpad',
    brand: 'Northpaw',
    category: 'accessory',
    description: 'Matte black wired numpad with low-profile keys, for 60% to 75% boards that dropped the number keys.',
    priceCents: 179000,
    stock: 20,
    specs: { connectivity: 'wired' },
  }),
  product(9, 'glide', 'glide-vane-pro', {
    name: 'Glide Vane Pro',
    brand: 'Glide',
    category: 'mouse',
    description: 'Symmetrical 54 g wireless mouse with a 30000 DPI optical sensor and 4000 Hz polling.',
    priceCents: 569000,
    compareAtCents: 649000, // on sale for the demo
    stock: 12,
    isFeatured: true,
    specs: { connectivity: 'wireless', sensor: 'PAW3950', dpiMax: 30000, pollingRateHz: 4000, weightGrams: 54, batteryMah: 300 },
  }),
  product(10, 'glide', 'glide-vane-mini', {
    name: 'Glide Vane Mini',
    brand: 'Glide',
    category: 'mouse',
    description: 'A compact wireless mouse in slate blue for small hands and claw grips. 49 g, with a silent scroll wheel.',
    priceCents: 329000,
    stock: 3,
    specs: { connectivity: 'wireless', sensor: 'PAW3395', dpiMax: 26000, pollingRateHz: 1000, weightGrams: 49, batteryMah: 250 },
  }),
  product(11, 'glide', 'glide-orbit-ergo', {
    name: 'Glide Orbit Ergo',
    brand: 'Glide',
    category: 'mouse',
    description: 'Right-handed ergonomic mouse with a thumb rest and silent clicks. Pairs with three devices.',
    priceCents: 219000,
    stock: 25,
    specs: { connectivity: 'bluetooth', sensor: 'PAW3212', dpiMax: 8000, pollingRateHz: 1000, weightGrams: 98, batteryMah: 600 },
  }),
  product(12, 'glide', 'glide-flick-wired', {
    name: 'Glide Flick Wired',
    brand: 'Glide',
    category: 'mouse',
    description: 'Wired 61 g mouse with a paracord cable and 8000 Hz polling. No battery, no charging.',
    priceCents: 149000,
    stock: 40,
    specs: { connectivity: 'wired', sensor: 'PAW3395', dpiMax: 18000, pollingRateHz: 8000, weightGrams: 61 },
  }),
  product(13, 'glide', 'glide-drift-travel', {
    name: 'Glide Drift Travel',
    brand: 'Glide',
    category: 'mouse',
    description: 'Flat Bluetooth travel mouse that slips into a laptop sleeve. Charges over USB-C.',
    priceCents: 129000,
    stock: 18,
    specs: { connectivity: 'bluetooth', sensor: 'PAW3212', dpiMax: 4000, pollingRateHz: 1000, weightGrams: 72, batteryMah: 400 },
  }),
  product(14, 'glide', 'glide-glow-pad-49', {
    name: 'Glide Glow Pad 49',
    brand: 'Glide',
    category: 'mousepad',
    description: 'Desk-length speed-weave pad with an RGB-lit edge and 12 lighting modes, powered over USB-C. 800 × 330 mm.',
    priceCents: 345000,
    stock: 9,
    isFeatured: true,
    specs: { weightGrams: 430 },
  }),
  product(15, 'glide', 'glide-cloth-xl', {
    name: 'Glide Cloth XL',
    brand: 'Glide',
    category: 'mousepad',
    description: 'Desk-sized 900 × 400 mm cloth pad with stitched edges and a balanced control surface.',
    priceCents: 119000,
    stock: 35,
    specs: { weightGrams: 780 },
  }),
  product(16, 'glide', 'glide-control-pad-m', {
    name: 'Glide Control Pad M',
    brand: 'Glide',
    category: 'mousepad',
    description: 'Medium 360 × 300 mm pad with a slower weave for precise micro-adjustments.',
    priceCents: 69000,
    stock: 50,
    specs: { weightGrams: 260 },
  }),
  product(17, 'hush', 'hush-veil-wireless', {
    name: 'Hush Veil Wireless',
    brand: 'Hush',
    category: 'headset',
    description: 'Closed-back wireless headset with memory-foam cushions and a detachable boom mic. 60 hours per charge.',
    priceCents: 725000,
    compareAtCents: 799000, // on sale for the demo
    saleEndsAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // ends today
    stock: 8,
    isFeatured: true,
    specs: { connectivity: 'wireless', weightGrams: 290, batteryMah: 1800 },
  }),
  product(18, 'hush', 'hush-studio-open', {
    name: 'Hush Studio Open',
    brand: 'Hush',
    category: 'headset',
    description: 'Open-back wired headset with a wide soundstage for single-player games and music.',
    priceCents: 439000,
    stock: 11,
    specs: { connectivity: 'wired', weightGrams: 320 },
  }),
  product(19, 'hush', 'hush-lite-headset', {
    name: 'Hush Lite Headset',
    brand: 'Hush',
    category: 'headset',
    description: 'A 210 g Bluetooth headset for calls and classes, with a flip-to-mute mic.',
    priceCents: 199000,
    stock: 27,
    specs: { connectivity: 'bluetooth', weightGrams: 210, batteryMah: 900 },
  }),
  product(20, 'hush', 'hush-frame-4k', {
    name: 'Hush Frame 4K',
    brand: 'Hush',
    category: 'webcam',
    description: '4K webcam with a large sensor, autofocus, and a privacy shutter. Clips onto any monitor.',
    priceCents: 619000,
    stock: 7,
    isFeatured: true,
    specs: { connectivity: 'wired', resolution: '4k', fps: 30 },
  }),
  product(21, 'hush', 'hush-frame-1080', {
    name: 'Hush Frame 1080',
    brand: 'Hush',
    category: 'webcam',
    description: 'Full HD webcam at 60 fps with dual microphones, made for streaming and meetings.',
    priceCents: 265000,
    stock: 19,
    specs: { connectivity: 'wired', resolution: '1080p', fps: 60 },
  }),
  product(22, 'hush', 'hush-frame-lite', {
    name: 'Hush Frame Lite',
    brand: 'Hush',
    category: 'webcam',
    description: 'A round, cherry-red 720p webcam for online classes. Plug-and-play, no drivers needed.',
    priceCents: 119000,
    stock: 2,
    specs: { connectivity: 'wired', resolution: '720p', fps: 30 },
  }),
  product(23, 'northpaw', 'northpaw-ridge-75', {
    name: 'Northpaw Ridge 75',
    brand: 'Northpaw',
    category: 'keyboard',
    description:
      'CNC aluminum 75% case in anodized red with a brass weight underneath. Wired, hot-swap, and shipped with lubed linear switches and a rotary knob.',
    priceCents: 789000,
    stock: 5,
    specs: { connectivity: 'wired', switchType: 'linear', layout: '75', pollingRateHz: 1000, weightGrams: 1650 },
  }),
  product(24, 'northpaw', 'northpaw-cloud-wrist-rest', {
    name: 'Northpaw Cloud Wrist Rest',
    brand: 'Northpaw',
    category: 'accessory',
    description: 'Slow-rebound memory foam in a dusk-grey knit cover, cut to sit flush with a 75% or TKL board. Non-slip base.',
    priceCents: 99000,
    stock: 30,
    specs: {},
  }),
  product(25, 'glide', 'glide-vane-air', {
    name: 'Glide Vane Air',
    brand: 'Glide',
    category: 'mouse',
    description:
      'A 54 g wireless mouse with a solid shell (no holes), a 26,000 DPI sensor, and 4000 Hz polling on the included dongle. About 80 hours per charge.',
    priceCents: 429000,
    stock: 16,
    isFeatured: true,
    specs: { connectivity: 'wireless', sensor: 'PAW3395', dpiMax: 26000, pollingRateHz: 4000, weightGrams: 54, batteryMah: 300 },
  }),
  product(26, 'glide', 'glide-speed-pad-l', {
    name: 'Glide Speed Pad L',
    brand: 'Glide',
    category: 'mousepad',
    description: 'Smooth, fast-glide surface over a firm 3 mm base, for low-sensitivity players who want less friction. 450 × 400 mm.',
    priceCents: 89000,
    compareAtCents: 119000, // on sale for the demo
    stock: 40,
    specs: { weightGrams: 380 },
  }),
  product(27, 'hush', 'hush-pulse-wireless', {
    name: 'Hush Pulse Wireless',
    brand: 'Hush',
    category: 'headset',
    description:
      'Matte black wireless headset with a detachable mic, 2.4 GHz and Bluetooth at the same time, and soft fabric cushions. Up to 50 hours per charge.',
    priceCents: 649000,
    stock: 9,
    specs: { connectivity: 'wireless', weightGrams: 278, batteryMah: 2000 },
  }),
  product(28, 'hush', 'hush-core-wired', {
    name: 'Hush Core Wired',
    brand: 'Hush',
    category: 'headset',
    description: 'A budget wired headset with 50 mm drivers, a bendable boom mic, and RGB earcups. 3.5 mm and USB.',
    priceCents: 179000,
    stock: 25,
    specs: { connectivity: 'wired', weightGrams: 320 },
  }),
  product(29, 'hush', 'hush-frame-pro-1440', {
    name: 'Hush Frame Pro 1440',
    brand: 'Hush',
    category: 'webcam',
    description: '1440p webcam at 60 fps with a glass lens, autofocus and a sliding privacy cover. Clips to monitors or sits on a desk.',
    priceCents: 489000,
    stock: 8,
    specs: { connectivity: 'wired', resolution: '1440p', fps: 60 },
  }),
  product(30, 'lumen', 'lumen-halo-light-bar', {
    name: 'Lumen Halo Light Bar',
    brand: 'Lumen',
    category: 'accessory',
    description:
      'Monitor light bar that lights the desk, not the screen, so there is no glare. Adjustable warmth and brightness from a wireless dial; powered over USB-C.',
    priceCents: 549000,
    stock: 11,
    isFeatured: true,
    specs: { connectivity: 'wired' },
  }),
  product(31, 'lumen', 'lumen-perch-stand', {
    name: 'Lumen Perch Headphone Stand',
    brand: 'Lumen',
    category: 'accessory',
    description: 'Matte black aluminum stand with a weighted tripod base and a padded hook that keeps headbands from denting.',
    priceCents: 129000,
    stock: 18,
    specs: {},
  }),
  product(32, 'lumen', 'lumen-duo-desk-mats', {
    name: 'Lumen Duo Felt Desk Mats',
    brand: 'Lumen',
    category: 'mousepad',
    description: 'Two wool-felt desk mats, one blush and one sky blue, to swap with the seasons. 900 × 400 mm each, with a cork underside.',
    priceCents: 149000,
    stock: 14,
    specs: { weightGrams: 520 },
  }),
  product(33, 'lumen', 'lumen-stream-cam', {
    name: 'Lumen Stream Cam',
    brand: 'Lumen',
    category: 'webcam',
    description: 'Compact 1080p webcam with a built-in mic and a twist-to-close privacy shutter, for calls and first streams.',
    priceCents: 189000,
    stock: 21,
    specs: { connectivity: 'wired', resolution: '1080p', fps: 30 },
  }),
];

// Each checkout is split into one order per seller, like the real checkout.
// [customer, days ago, status, [[product number, qty], ...]]
export const checkouts = [
  // Earlier buyers, 2 to 4 months back: everything delivered and reviewed (see pastReviews).
  ['rafael', 128, 'delivered', [[1, 1], [9, 1], [17, 1]]],
  ['bea', 121, 'delivered', [[1, 1], [25, 1], [26, 1], [30, 1]]],
  ['carlo', 114, 'delivered', [[1, 1], [9, 1], [26, 1], [18, 1]]],
  ['miguel', 106, 'delivered', [[1, 1], [25, 1], [20, 1], [6, 1]]],
  ['jas', 97, 'delivered', [[23, 1], [17, 1], [33, 1]]],
  ['andrea', 89, 'delivered', [[23, 1], [17, 1], [32, 1], [30, 1]]],
  ['josh', 78, 'delivered', [[23, 1], [9, 1], [20, 1], [6, 1]]],
  ['nina', 68, 'delivered', [[1, 1], [25, 1], [32, 1]]],
  // The month before the dashboard's 30 days, a little quieter, so the sales chart has something to compare against.
  ['paolo', 57, 'delivered', [[2, 1]]],
  ['lea', 51, 'delivered', [[11, 1], [16, 1]]],
  ['mika', 46, 'delivered', [[5, 1]]],
  ['paolo', 41, 'delivered', [[22, 1]]],
  ['lea', 36, 'delivered', [[27, 1], [3, 1]]],
  ['mika', 32, 'delivered', [[14, 1]]],
  ['mika', 29, 'delivered', [[1, 1], [9, 1]]],
  ['paolo', 27, 'delivered', [[12, 1], [15, 1]]],
  ['lea', 25, 'delivered', [[17, 1]]],
  ['mika', 22, 'delivered', [[20, 1], [14, 1]]],
  ['paolo', 20, 'delivered', [[4, 1], [7, 2]]],
  ['lea', 18, 'cancelled', [[3, 1]]],
  ['mika', 16, 'delivered', [[19, 1]]],
  ['lea', 13, 'delivered', [[2, 1], [11, 1]]],
  ['mika', 12, 'delivered', [[30, 1], [31, 1]]],
  ['paolo', 10, 'delivered', [[25, 1], [27, 1]]],
  ['lea', 9, 'delivered', [[23, 1], [24, 1]]],
  // Shipped orders stay under 7 days since shipping, or the hourly auto-complete would mark them delivered.
  ['lea', 6, 'processing', [[21, 1], [16, 2]]],
  ['paolo', 5, 'shipped', [[18, 1]]],
  // Delivered about a day ago, so a return can be demonstrated within its 7-day window.
  ['lea', 5, 'delivered', [[10, 1]]],
  ['mika', 4, 'shipped', [[6, 1]]],
  ['paolo', 4, 'processing', [[9, 1]]],
  ['mika', 2, 'placed', [[8, 1], [13, 1]]],
  ['lea', 1, 'placed', [[5, 1]]],
];

// [customer, product number, rating, title, body]. Only for delivered items.
export const reviews = [
  ['mika', 1, 5, 'Best board I have owned', 'The gasket mount makes typing soft without feeling mushy. Battery lasted three weeks of daily use.'],
  ['mika', 9, 4, 'Light and accurate', 'Tracking is flawless and the shape fits my claw grip. The side buttons could be a bit firmer.'],
  ['paolo', 12, 5, 'No wireless, no problem', 'The cable is so light I forget it is there. Clicks feel crisp and consistent.'],
  ['paolo', 15, 4, 'Covers the whole desk', 'Great glide and the stitching has held up. It smelled a little for the first two days.'],
  ['lea', 17, 5, 'Comfortable for hours', 'I wear these for six-hour shifts and my ears never get sore. The mic sounds clear on calls.'],
  ['mika', 20, 4, 'Sharp picture', 'Colors look natural even in a dim room. The clip is sturdy on a thin monitor bezel.'],
  ['paolo', 4, 3, 'Loud, as expected', 'Clicky switches feel great but my roommate hates them. Build quality is good for the price.'],
  ['lea', 2, 5, 'Smooth and fast', 'Linear switches are buttery right out of the box. Tiny footprint leaves room for my mouse.'],
  ['lea', 11, 4, 'Easy on the wrist', 'My wrist pain went away after a week. It takes a few days to get used to the angle.'],
  ['mika', 30, 5, 'No more screen glare', 'Lights my keyboard without a single reflection on the monitor. The dial is a nice touch.'],
  ['paolo', 25, 5, 'Feels like nothing', 'I forget it is wireless. Clicks are crisp and the battery lasts all week.'],
  ['paolo', 27, 4, 'Comfy and light', 'Great for long sessions and the mic is clear. Wish the white did not show dust so easily.'],
  ['lea', 23, 5, 'Heavy in the best way', 'The aluminum case does not move at all and it sounds deep. Worth saving up for.'],
];

// Buyer photos on a few of the earlier buyers' reviews, keyed "buyer:product number". Free-licence Pexels photos
// (client/public/reviews), picked to look like a buyer's own desk: Marcus Richardson (Ridge 75), minhphuc .workspace
// and Sai Krishna Sudevan (Aster 75).
export const reviewPhotos = {
  'jas:23': ['/reviews/northpaw-ridge-75-desk.webp'],
  'bea:1': ['/reviews/northpaw-aster-75-topo-mat.webp', '/reviews/northpaw-aster-75-night-desk.webp'],
};

// The earlier buyers' reviews: [buyer, product number, stars, title, body, shop reply?]. A spread of ratings, so the
// breakdown bars on the busier products have something to show.
export const pastReviews = [
  ['bea', 1, 5, 'Worth every peso', 'Tri-mode works exactly as advertised. I switch between my laptop and PC all day with zero lag.'],
  ['carlo', 1, 4, 'Great board, heavy case', 'Typing feel is excellent and it sounds deep. It is heavier than I expected, so not great for travel.'],
  ['miguel', 1, 5, 'Arrived fast in Davao', 'Packed well and it reached me in four days. The knob is genuinely useful for volume.'],
  ['nina', 1, 3, 'Good, but the stabilizers rattle', 'The switches are lovely but the spacebar rattles a little. Some lube fixed most of it.', 'Thanks for the honest note, Nina. We now lube every stabilizer before shipping.'],
  ['rafael', 1, 4, 'Solid daily driver', 'Battery life is long and the keycaps feel thick. The software is basic but does the job.'],
  ['jas', 23, 5, 'The sound is unreal', 'Deep, muted thock straight out of the box. Prettiest board on my desk.'],
  ['josh', 23, 4, 'Compact without compromise', 'I keep the arrow keys and lose the numpad. The cable is a bit stiff.'],
  ['andrea', 23, 2, 'Two keys stopped working', 'After three weeks the J and K keys went dead. Swapping in new switches fixed it, but I expected better.', 'Sorry about that, Andrea. Message us and we will send replacement switches for free.'],
  ['carlo', 9, 5, 'Best sensor I have used', 'Zero spin-outs even on fast flicks. The coating has not worn down after two months.'],
  ['josh', 9, 5, 'Light and fast', 'Perfect for shooters. Charges quickly and lasts a week of play.'],
  ['rafael', 9, 3, 'Too small for my hand', 'Tracks perfectly but my palm hangs off the back. Fine for claw grip, not for palm grip.'],
  ['bea', 25, 4, 'Clean, quiet clicks', 'Quiet enough for late nights. The scroll wheel is a little loose for my taste.'],
  ['nina', 25, 5, 'Lightest mouse I own', 'My wrist thanks me. The shape is safe and the feet glide well on cloth.'],
  ['miguel', 25, 1, 'Stopped charging', 'It stopped taking a charge after a month. The shop replaced it quickly, but the first one was a dud.', 'Glad the replacement is working, Miguel. That batch had a faulty port and we have pulled it.'],
  ['andrea', 17, 5, 'Silence is golden', 'The noise cancelling beats my old earbuds. Comfortable even with glasses.'],
  ['jas', 17, 4, 'Great sound, tight fit', 'Rich bass and a clear mic. The headband is snug for the first week.'],
  ['rafael', 17, 2, 'The mic picks up everything', 'Music sounds great, but my team hears my keyboard on calls. Not for a noisy room.'],
  ['miguel', 20, 4, 'Sharp picture', 'Crisp 4K and the autofocus is quick. It struggles a little in a dim room.'],
  ['josh', 20, 5, 'My streams look pro now', 'Viewers noticed the upgrade straight away. The mount fits my monitor perfectly.'],
  ['bea', 26, 5, 'Fast but controlled', 'Glides fast yet stops right where I want. The edges have not frayed.'],
  ['carlo', 26, 3, 'Too fast for me', 'Well made, but I prefer a slower surface. Good if you like speed.'],
  ['nina', 32, 4, 'Cute and practical', 'The two colours look great on my desk and the felt keeps my wrists warm.'],
  ['andrea', 32, 5, 'My desk looks so tidy', 'Covers my whole desk. No smell and no curling at the corners.'],
  ['jas', 33, 3, 'Okay for calls', 'Fine for meetings, but colours look a little washed out under warm light.'],
  ['josh', 6, 4, 'Wireless done right', 'Bluetooth pairs instantly and the 2.4 GHz dongle has no lag. I wish it came in white.'],
  ['miguel', 6, 5, 'My favourite purchase', 'Smaller than my old board and I do not miss the extra keys at all.'],
  ['carlo', 18, 4, 'Open and airy', 'Sounds spacious and great for single-player games. It leaks sound, so not for the office.'],
  ['andrea', 30, 4, 'Great for night work', 'Lights the desk without glare. The clamp could be a little sturdier.'],
  ['bea', 30, 5, 'Easy on the eyes', 'Late-night coding is much more comfortable now. It takes a minute to install.'],
];

// Refunded returns, each with the review its buyer left: [customer, product number, reason, what they reported,
// rating, review title, review text]. A refunded product's review is low, the way a real one would be, and shops see a
// "Returned for a refund" tag on it. Each is on a delivered order above, and for one unit of that line.
export const refundedReturns = [
  ['mika', 19, 'not-as-described', 'The ear cups are much smaller than they look in the photos and sit on my ears instead of around them.', 2, 'Smaller than it looks', 'The cups press on my ears and get sore within an hour. Sound is fine, but the size is not what the photos show.'],
  ['lea', 24, 'damaged', 'The wrist rest arrived with a torn seam and the foam poking out.', 2, 'Torn seam on arrival', 'The fabric is soft and the height is right, but the seam was torn open out of the box, so I sent it back.'],
];

// What buyers said about riders, applied to the oldest delivered orders in turn (each also marked received):
// [rider, stars, comment, report, reviewedNote]. Dante's five ratings average 2.4, which sets off the admins'
// low-rating alert. Ramon's two are as bad but too few to say anything yet, so no alert (on purpose). Rico was
// reported, which paused him from new deliveries until an admin looks. Joy is doing fine.
export const riderStory = [
  ['dante', 2, 'Left the box at the gate without calling.', null, 'Spoke to Dante about calling ahead.'],
  ['dante', 3, null, null, null],
  ['dante', 2, 'Over an hour late and the box was dented.', null, null],
  ['dante', 2, null, null, null],
  ['dante', 3, null, null, null],
  ['rico', null, null, { reason: 'harassment', note: 'He kept texting my number after the delivery, asking to meet up.' }, null],
  ['ramon', 2, "Didn't call when he arrived, I had to go looking for him.", null, null],
  ['ramon', 1, null, null, null],
  ['joy', 5, 'Quick and polite.', null, null],
  ['joy', 5, null, null, null],
];

// Discount codes. Each customer may use a code once; the server computes and splits the discount.
export const coupons = [
  { code: 'LOADOUT10', type: 'percent', value: 10, minSubtotalCents: 300000 },
  { code: 'WELCOME200', type: 'fixed', value: 20000, minSubtotalCents: 150000 },
  { code: 'LAUNCH25', type: 'percent', value: 25, minSubtotalCents: 0, expiresAt: new Date('2026-01-31T15:59:59Z') },
];
