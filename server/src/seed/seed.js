import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Coupon, Notification, Order, Product, Review, User } from '../models/index.js';
import { shippingFor } from '../features/orders/shipping.js';
import { checkouts, coupons, products, reviews, users } from './data.js';

const PASSWORD = 'password123';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Backdated steps for a seeded order that reached `status`: prepared the next day, shipped a day later,
// out for delivery the morning it arrives, delivered that afternoon; cancellations happen a few hours after placing.
function historyFor(status, placedAt) {
  const at = (hours) => new Date(placedAt.getTime() + hours * HOUR_MS);
  if (status === 'cancelled') return [{ status: 'placed', at: at(0) }, { status: 'cancelled', at: at(5) }];
  const steps = [['placed', 0], ['processing', 20], ['shipped', 44], ['out-for-delivery', 86], ['delivered', 92]];
  const upTo = steps.findIndex(([s]) => s === status);
  return steps.slice(0, upTo + 1).map(([s, h]) => ({ status: s, at: at(h) }));
}

export async function seed() {
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Coupon.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // create() runs the password hashing hook for each user.
  const userDocs = await User.create(
    Object.values(users).map((u) => ({
      ...u,
      password: PASSWORD,
      ...(u.sellerProfile && { sellerProfile: { appliedAt: new Date(Date.now() - 40 * DAY_MS), ...u.sellerProfile } }),
    })),
  );
  await Product.create(products);
  const byNumber = new Map(products.map((p, i) => [i + 1, p]));

  // Built with new Order() + validate() so totals are computed, then inserted raw to keep backdated timestamps.
  const orderDocs = [];
  const riders = Object.values(users).filter((u) => u.role === 'rider');
  let handedOver = 0;
  for (const [customer, daysAgo, status, lines] of checkouts) {
    const createdAt = new Date(Date.now() - daysAgo * DAY_MS - 3 * 60 * 60 * 1000);
    const checkoutId = randomUUID();
    const bySeller = new Map();
    for (const [n, qty] of lines) {
      const p = byNumber.get(n);
      const key = p.seller.toString();
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push({ product: p._id, name: p.name, priceCents: p.priceCents, qty, image: p.images[0].url });
    }
    for (const [seller, items] of bySeller) {
      const order = new Order({
        user: users[customer]._id,
        seller,
        checkoutId,
        items,
        shippingAddress: users[customer].shippingAddress,
        shippingCents: shippingFor(items.reduce((sum, i) => sum + i.priceCents * i.qty, 0)),
        paymentMethod: daysAgo % 2 ? 'cod' : 'mock-card',
        status,
        ...(status === 'cancelled' && { cancelledBy: 'customer' }),
        // Anything that left the shop went with a rider, taking turns.
        ...(['shipped', 'out-for-delivery', 'delivered'].includes(status) && { rider: riders[handedOver++ % riders.length]._id }),
        ...(status === 'delivered' && { deliveredBy: 'rider' }),
        statusHistory: historyFor(status, createdAt),
      });
      await order.validate();
      orderDocs.push({ ...order.toObject(), createdAt, updatedAt: createdAt });
    }
  }
  await Order.collection.insertMany(orderDocs);
  await Coupon.create(coupons);

  // A few recent notices so the bell has something in it on first login.
  const recent = [...orderDocs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  await Notification.collection.insertMany(
    recent.flatMap((o) => {
      const at = o.statusHistory.at(-1).at;
      const id = `#${String(o._id).slice(-6).toUpperCase()}`;
      return [
        { user: o.seller, type: 'order', title: `New order ${id}`, body: `${o.items.length} item${o.items.length === 1 ? '' : 's'}.`, link: `/orders/${o._id}`, createdAt: o.createdAt, updatedAt: o.createdAt },
        ...(o.status !== 'placed'
          ? [{ user: o.user, type: 'order', title: `Order ${id} ${o.status === 'shipped' ? 'has shipped' : o.status === 'delivered' ? 'was delivered' : o.status === 'cancelled' ? 'was cancelled' : 'is being prepared'}`, body: o.items.map((i) => i.name).join(', '), link: `/orders/${o._id}`, createdAt: at, updatedAt: at }]
          : []),
      ];
    }),
  );

  // One at a time through create() so the rating hooks run for every review.
  for (const [customer, n, rating, title, body] of reviews) {
    await Review.create({ user: users[customer]._id, product: byNumber.get(n)._id, rating, title, body });
  }

  return { users: userDocs.length, products: products.length, orders: orderDocs.length, reviews: reviews.length };
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  await import('dotenv/config');
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI to seed a real database. The in-memory dev database seeds itself on start.');
    process.exit(1);
  }
  // Seeding deletes every collection first. A database on this machine is fair game; anything else (an
  // Atlas cluster, the live site) needs an explicit flag, so a stray URI in a local .env can't wipe it.
  const host = process.env.MONGODB_URI.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, '').split(/[/:?,]/)[0];
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!isLocal && !process.argv.includes('--wipe-remote')) {
    console.error(
      `MONGODB_URI points at ${host}, not this machine. Seeding deletes every user, product, order, review, ` +
        'discount code and notification there, then recreates the demo accounts (all with the demo password).\n' +
        'If that is really what you want, run: npm run seed -- --wipe-remote',
    );
    process.exit(1);
  }
  const { connectDB, disconnectDB } = await import('../config/db.js');
  await connectDB();
  console.log('Seeded', await seed());
  await disconnectDB();
}
