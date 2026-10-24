import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { ActivityLog, Coupon, Notification, Order, Product, ReturnRequest, Review, RiderFeedback, User } from '../models/index.js';
import { shippingFor } from '../features/orders/shipping.js';
import { checkouts, coupons, pastReviews, products, refundedReturns, reviewPhotos, reviews, riderStory, users } from './data.js';
import { orderNumber } from '../lib/format.js';

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
    ReturnRequest.deleteMany({}),
    RiderFeedback.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);

  // create() runs the password hashing hook for each user.
  const userDocs = await User.create(
    Object.values(users).map((u) => ({
      ...u,
      password: PASSWORD,
      ...(u.sellerProfile && { sellerProfile: { appliedAt: new Date(Date.now() - 40 * DAY_MS), ...u.sellerProfile } }),
    })),
  );
  // The demo shops opened months ago, not on the day the seed ran, so "selling since" reads like a real shop.
  // Straight to the collection: Mongoose treats createdAt as read-only and would drop the change.
  const OPENED_DAYS_AGO = { northpaw: 420, glide: 300, hush: 210, lumen: 130 };
  // Everyone else joined over the past months too, each before their first seeded order or delivery (riders before
  // the oldest delivery their riderStory puts on them).
  const JOINED_DAYS_AGO = {
    owner: 500, admin: 450, mika: 180, ramon: 240, joy: 150, paolo: 95, dante: 135, rico: 130, lea: 60, coilworks: 45,
    // The earlier buyers joined a little before their first order.
    rafael: 140, bea: 133, carlo: 126, miguel: 118, jas: 109, andrea: 101, josh: 90, nina: 80,
  };
  await User.collection.bulkWrite(
    Object.entries(JOINED_DAYS_AGO).map(([key, days]) => ({
      updateOne: { filter: { _id: users[key]._id }, update: { $set: { createdAt: new Date(Date.now() - days * DAY_MS) } } },
    })),
  );
  await User.collection.bulkWrite(
    Object.entries(OPENED_DAYS_AGO).map(([key, days]) => ({
      updateOne: {
        filter: { _id: users[key]._id },
        update: {
          $set: {
            createdAt: new Date(Date.now() - days * DAY_MS),
            'sellerProfile.appliedAt': new Date(Date.now() - (days - 1) * DAY_MS),
          },
        },
      },
    })),
  );
  await Product.create(products);
  const byNumber = new Map(products.map((p, i) => [i + 1, p]));

  // Built with new Order() + validate() so totals are computed, then inserted raw to keep backdated timestamps.
  const orderDocs = [];
  const riders = [users.ramon, users.joy]; // the others' orders come from riderStory below
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
        paymentMethod: ['cod', 'mock-gcash', 'mock-card'][daysAgo % 3],
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
      const id = orderNumber(o._id);
      return [
        { user: o.seller, type: 'order', title: `New order ${id}`, body: `${o.items.length} item${o.items.length === 1 ? '' : 's'}.`, link: `/orders/${o._id}`, createdAt: o.createdAt, updatedAt: o.createdAt },
        ...(o.status !== 'placed'
          ? [{ user: o.user, type: 'order', title: `Order ${id} ${o.status === 'shipped' ? 'is waiting for rider pickup' : o.status === 'delivered' ? 'was delivered' : o.status === 'cancelled' ? 'was cancelled' : 'is being prepared'}`, body: o.items.map((i) => i.name).join(', '), link: `/orders/${o._id}`, createdAt: at, updatedAt: at }]
          : []),
      ];
    }),
  );

  // One at a time through create() so the rating hooks run for every review, then dated a day after the buyer's
  // delivery of that product (through the collection, so the timestamps stick) instead of all reading "today".
  const deliveredAt = (user, product) =>
    orderDocs
      .filter((o) => String(o.user) === String(user) && o.status === 'delivered' && o.items.some((i) => String(i.product) === String(product)))
      .map((o) => o.statusHistory.find((h) => h.status === 'delivered').at)
      .sort((a, b) => a - b)[0];
  // `after` spreads reviews out (some buyers write the same day, some a few days later); a shop reply, if any, comes
  // a day after the review.
  const backdate = async (review, after = 1) => {
    const delivered = deliveredAt(review.user, review.product);
    if (!delivered) return;
    const at = new Date(Math.min(delivered.getTime() + after * DAY_MS, Date.now()));
    const replied = review.reply?.body && { 'reply.at': new Date(Math.min(at.getTime() + DAY_MS, Date.now())) };
    await Review.collection.updateOne({ _id: review._id }, { $set: { createdAt: at, updatedAt: at, ...replied } });
  };
  for (const [i, [customer, n, rating, title, body, reply]] of pastReviews.entries()) {
    const review = await Review.create({
      user: users[customer]._id,
      product: byNumber.get(n)._id,
      rating,
      title,
      body,
      ...(reply && { reply: { body: reply, at: new Date() } }),
      ...(reviewPhotos[`${customer}:${n}`] && { images: reviewPhotos[`${customer}:${n}`] }),
    });
    await backdate(review, 1 + (i % 4));
  }
  for (const [customer, n, rating, title, body] of reviews) {
    await backdate(await Review.create({ user: users[customer]._id, product: byNumber.get(n)._id, rating, title, body }));
  }

  // Refunded returns and the low reviews their buyers left. Backdated through the collection (like the orders) so each
  // return starts a day after delivery and ends refunded two days later, well inside the 7-day window.
  const returnDocs = [];
  for (const [customer, n, reason, details, rating, title, body] of refundedReturns) {
    const product = byNumber.get(n);
    const order = orderDocs.find((o) => String(o.user) === String(users[customer]._id) && o.status === 'delivered' && o.items.some((i) => String(i.product) === String(product._id)));
    const line = order.items.find((i) => String(i.product) === String(product._id));
    const delivered = order.statusHistory.find((h) => h.status === 'delivered').at;
    const at = (days) => new Date(delivered.getTime() + days * DAY_MS);
    returnDocs.push({
      _id: new mongoose.Types.ObjectId(),
      order: order._id,
      user: order.user,
      seller: order.seller,
      items: [{ product: product._id, name: line.name, qty: 1, refundCents: line.priceCents }],
      reason,
      details,
      status: 'refunded',
      refundCents: line.priceCents,
      history: [
        { status: 'requested', by: 'customer', at: at(1) },
        { status: 'approved', by: 'seller', at: at(2) },
        { status: 'refunded', by: 'seller', at: at(3) },
      ],
      createdAt: at(1),
      updatedAt: at(3),
    });
    await Order.collection.updateOne({ _id: order._id }, { $set: { refundedCents: line.priceCents } });
    await backdate(await Review.create({ user: order.user, product: product._id, rating, title, body }));
  }
  if (returnDocs.length) await ReturnRequest.collection.insertMany(returnDocs);

  // Other shoppers' helpful votes, so "Most helpful" has an order: well-rated, longer reviews collect more thumbs up,
  // low ones a few thumbs down. Fixed by position (no randomness), and never the author's own vote.
  const shoppers = Object.values(users).filter((u) => u.role === 'customer').map((u) => u._id);
  const all = await Review.find({}).sort({ createdAt: 1 }).select('user rating body').lean();
  await Review.bulkWrite(
    all.map((r, i) => {
      const others = shoppers.filter((id) => String(id) !== String(r.user));
      const ups = Math.min(others.length, (r.rating >= 4 ? 2 : 0) + Math.floor(r.body.length / 45) + (i % 3));
      const downs = r.rating <= 2 ? 1 + (i % 2) : i % 5 === 0 ? 1 : 0;
      const helpful = others.slice(0, ups);
      const unhelpful = others.slice(ups, ups + downs);
      return { updateOne: { filter: { _id: r._id }, update: { $set: { helpful, unhelpful, helpfulCount: helpful.length } } } };
    }),
    { timestamps: false },
  );

  // Riders' ratings and reports (riderStory), on the oldest delivered orders, each confirmed received two hours after
  // delivery. Built with new + validate() so `flagged` is worked out, then inserted raw to keep the backdated dates.
  const owner = users.owner._id;
  const oldestDelivered = orderDocs.filter((o) => o.status === 'delivered').sort((a, b) => a.createdAt - b.createdAt);
  const feedbackDocs = [];
  for (const [i, [rider, stars, comment, report, reviewedNote]] of riderStory.entries()) {
    const order = oldestDelivered[i];
    const at = new Date(order.statusHistory.at(-1).at.getTime() + 2 * HOUR_MS);
    await Order.collection.updateOne({ _id: order._id }, { $set: { rider: users[rider]._id, receivedAt: at } });
    const doc = new RiderFeedback({
      order: order._id,
      rider: users[rider]._id,
      user: order.user,
      ...(stars && { stars }),
      ...(comment && { comment }),
      ...(report && { report: { ...report, at } }),
      ...(reviewedNote && { reviewedAt: new Date(at.getTime() + DAY_MS), reviewedBy: owner, reviewNote: reviewedNote }),
    });
    await doc.validate();
    feedbackDocs.push({ ...doc.toObject(), createdAt: at, updatedAt: at });
  }
  // Most buyers rate too, so each rider's count follows their deliveries: about 7 in 10 of their older delivered
  // orders (return window closed, so nothing waits on the buyer), confirmed received and rated. Dante's extras are 3s,
  // so his story (an average under 3) holds and nothing new lands in the admins' queue (only 2 stars or less does).
  const storyOrders = new Set(oldestDelivered.slice(0, riderStory.length).map((o) => String(o._id)));
  const closed = Date.now() - 7 * DAY_MS;
  const PATTERN = { joy: [5, 5, 4, 5, 5, 5, 4, 5], ramon: [4, 5, 4, 4, 5, 3, 4, 5], rico: [4, 4, 5, 3, 4], dante: [3] };
  const NOTES = ['Called ahead, easy handover.', 'Parcel was well looked after.', 'On time.', 'Friendly and quick.'];
  for (const [key, pattern] of Object.entries(PATTERN)) {
    const theirs = orderDocs.filter(
      (o) =>
        o.status === 'delivered' &&
        String(o.rider) === String(users[key]._id) &&
        !storyOrders.has(String(o._id)) &&
        o.statusHistory.at(-1).at.getTime() < closed,
    );
    for (const [i, order] of theirs.entries()) {
      if (i % 10 >= 7) continue;
      const stars = pattern[i % pattern.length];
      const at = new Date(order.statusHistory.at(-1).at.getTime() + 3 * HOUR_MS);
      await Order.collection.updateOne({ _id: order._id }, { $set: { receivedAt: at } });
      const doc = new RiderFeedback({
        order: order._id,
        rider: users[key]._id,
        user: order.user,
        stars,
        ...(stars >= 4 && i % 4 === 0 && { comment: NOTES[i % NOTES.length] }),
      });
      await doc.validate();
      feedbackDocs.push({ ...doc.toObject(), createdAt: at, updatedAt: at });
    }
  }
  await RiderFeedback.collection.insertMany(feedbackDocs);
  const dante = feedbackDocs.filter((f) => String(f.rider) === String(users.dante._id) && f.stars);
  const danteAvg = (dante.reduce((n, f) => n + f.stars, 0) / dante.length).toFixed(1);
  const now = new Date();
  await User.updateOne({ _id: users.dante._id }, { 'riderProfile.lowRatingAlertAt': now });
  await User.updateOne({ _id: users.rico._id }, { 'riderProfile.heldAt': now, 'riderProfile.heldReason': 'Reported by a buyer' });
  const alert = (title, body, rider) => ({ user: owner, type: 'account', title, body, link: `/admin/riders/${rider}`, createdAt: now, updatedAt: now });
  await Notification.collection.insertMany([
    alert("Dante Lim's rating fell below 3 stars", `${danteAvg} stars over ${dante.length} ratings. Open their record to read them.`, users.dante._id),
    alert('A buyer reported Rico Mendoza', "They're paused from new deliveries until you clear them or deactivate the account.", users.rico._id),
  ]);

  await seedActivity();

  return { users: userDocs.length, products: products.length, orders: orderDocs.length, reviews: reviews.length + pastReviews.length + refundedReturns.length };
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

// A few months of admin work, so the Activity log isn't empty in a demo. The approvals and the promotion are history
// (not undoable); featuring a product and changing a code's minimum are recent and can be undone by the owner.
async function seedActivity() {
  const at = (days) => new Date(Date.now() - days * DAY_MS);
  const who = (u) => ({ actor: u._id, actorName: u.name });
  const { owner, admin } = users;
  const featured = await Product.findOne({ isFeatured: true }).sort({ createdAt: 1 });
  const code = await Coupon.findOne({ code: 'LOADOUT10' });
  const shops = Object.entries({ northpaw: 419, glide: 299, hush: 209, lumen: 119 }).map(([key, days]) => ({
    ...who(owner),
    action: 'seller.approve',
    target: { kind: 'seller', id: users[key]._id, label: users[key].sellerProfile.shopName },
    summary: `approved ${users[key].sellerProfile.shopName}`,
    undoable: false,
    createdAt: at(days),
  }));
  await ActivityLog.collection.insertMany([
    {
      ...who(owner),
      action: 'user.promote',
      target: { kind: 'user', id: admin._id, label: `${admin.name} (${admin.email})` },
      summary: `made ${admin.name} an admin`,
      undoable: false,
      createdAt: at(440),
    },
    ...shops,
    {
      ...who(admin),
      action: 'product.moderate',
      target: { kind: 'product', id: featured._id, label: featured.name },
      summary: `featured ${featured.name}`,
      undo: { before: { isActive: true, isFeatured: false }, after: { isActive: true, isFeatured: true } },
      undoable: true,
      createdAt: at(9),
    },
    {
      ...who(admin),
      action: 'coupon.update',
      target: { kind: 'coupon', id: code._id, label: code.code },
      summary: `edited code ${code.code}`,
      undo: { before: { minSubtotalCents: 200000 }, after: { minSubtotalCents: code.minSubtotalCents } },
      undoable: true,
      createdAt: at(4),
    },
  ]);
}
