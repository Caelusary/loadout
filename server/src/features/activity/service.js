import mongoose from 'mongoose';
import { ActivityLog, Coupon, Order, Product, Review, User } from '../../models/index.js';
import { ON_THE_WAY } from '../../models/Order.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { relistProducts, unlistSellerProducts } from '../products/service.js';
import { notify } from '../notifications/service.js';

// Labels for the log, so entries read the same after names change.
export const userLabel = (u) => `${u.name} (${u.email})`;
export const orderLabel = (o) => `Order #${String(o._id).slice(-6).toUpperCase()}`;

// Written inside the action's own transaction, so an action and its entry succeed or fail together.
export function record(actor, { action, target, summary, undo, undoable = true }, session) {
  return ActivityLog.create(
    [{ actor: actor._id, actorName: actor.name, action, target, summary, undo, undoable }],
    { session },
  );
}

// A deleted account can be restored for 30 days; after that its saved copy is erased (purgeExpired).
const RESTORE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const recalcRatings = (reviews) =>
  Promise.all(
    [...new Set(reviews.map((r) => String(r.product)))].map((id) => Review.calcRating(new mongoose.Types.ObjectId(id))),
  );

const stale = () => new AppError(409, 'CONFLICT', 'This has changed since, so it can no longer be undone.');
const gone = (what) => new AppError(409, 'CONFLICT', `${what} no longer exists, so this can't be undone.`);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function loadUser(id, session) {
  const user = await User.findById(id).session(session);
  if (!user) throw gone('That account');
  return user;
}

const isApprovedSeller = (u) => u.isActive && u.role === 'seller' && u.sellerProfile?.status === 'approved';

// Each handler checks the target is still exactly as the action left it, then puts it back.
// A handler may return a function to run after the transaction commits.
const UNDO = {
  async 'user.deactivate'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.isActive) throw stale();
    user.isActive = true;
    await user.save({ session });
    if (isApprovedSeller(user)) await relistProducts(undo.unlisted, session);
  },

  async 'user.activate'({ target }, session) {
    const user = await loadUser(target.id, session);
    if (!user.isActive) throw stale();
    user.isActive = false;
    await user.save({ session });
    if (user.role === 'seller') await unlistSellerProducts(user._id, session);
  },

  async 'user.delete'({ undo, createdAt }, session) {
    if (!undo?.user || Date.now() - createdAt.getTime() > RESTORE_DAYS * DAY_MS) {
      throw new AppError(409, 'CONFLICT', `Deleted accounts can only be restored within ${RESTORE_DAYS} days.`);
    }
    const { user, reviews, unlisted } = undo;
    if (await User.exists({ _id: user._id }).session(session)) throw stale();
    if (await User.exists({ email: user.email }).session(session)) {
      throw new AppError(409, 'CONFLICT', 'Someone has signed up with that email since, so this account cannot be restored.');
    }
    // Raw inserts keep the original ids, timestamps and password hash.
    await User.collection.insertOne(user, { session });
    if (reviews.length) await Review.collection.insertMany(reviews, { session });
    if (isApprovedSeller(user)) await relistProducts(unlisted, session);
    return () => recalcRatings(reviews);
  },

  async 'user.promote'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.role !== 'admin') throw stale();
    Object.assign(user, { role: 'customer', adminPermissions: undefined, cart: undo.cart ?? [] });
    await user.save({ session });
  },

  async 'user.demote'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.role !== 'customer' || user.sellerProfile) throw stale();
    Object.assign(user, { role: 'admin', adminPermissions: undo.permissions, cart: [] });
    await user.save({ session });
  },

  async 'user.rider'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.role !== 'rider') throw stale();
    if (await Order.exists({ rider: user._id, status: { $in: ON_THE_WAY } }).session(session)) {
      throw new AppError(409, 'CONFLICT', 'This rider has deliveries on the way. Undo once those are done.');
    }
    Object.assign(user, { role: 'customer', cart: undo.cart ?? [] });
    await user.save({ session });
  },

  async 'user.unrider'({ target }, session) {
    const user = await loadUser(target.id, session);
    if (user.role !== 'customer' || user.sellerProfile) throw stale();
    Object.assign(user, { role: 'rider', cart: [] });
    await user.save({ session });
  },

  async 'user.permissions'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.role !== 'admin' || !same([...(user.adminPermissions ?? [])], undo.after)) throw stale();
    user.adminPermissions = undo.before;
    await user.save({ session });
  },

  async 'seller.approve'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.sellerProfile?.status !== 'approved') throw stale();
    if (await Product.exists({ seller: user._id }).session(session)) {
      throw new AppError(409, 'CONFLICT', 'This shop has listed products since. Suspend it instead.');
    }
    Object.assign(user.sellerProfile, { status: undo.before.status, reviewedAt: undo.before.reviewedAt });
    user.role = undo.before.role;
    await user.save({ session });
    const shop = user.sellerProfile.shopName;
    return () =>
      notify({
        user: user._id,
        type: 'seller',
        title: `${shop}'s approval was withdrawn`,
        body: 'Your application is back under review.',
        link: '/account/sell',
      });
  },

  async 'seller.suspend'({ target, undo }, session) {
    const user = await loadUser(target.id, session);
    if (user.sellerProfile?.status !== 'suspended') throw stale();
    Object.assign(user.sellerProfile, { status: undo.before.status, reviewedAt: undo.before.reviewedAt });
    user.role = undo.before.role;
    await user.save({ session });
    if (isApprovedSeller(user)) await relistProducts(undo.unlisted, session);
    const shop = user.sellerProfile.shopName;
    const wasApproved = undo.before.status === 'approved';
    // The shop hears it's back; each customer whose order the suspension cancelled can order again.
    // The orders themselves stay cancelled: those customers may have bought elsewhere since.
    const customers = [...new Set((undo.cancelled ?? []).map((c) => String(c.user)))];
    return () =>
      notify([
        {
          user: user._id,
          type: 'seller',
          title: wasApproved ? `${shop} is reinstated` : `${shop}'s application is being reconsidered`,
          body: wasApproved ? 'Your shop and its products are back on Loadout.' : 'Your application is back under review.',
          link: wasApproved ? '/seller' : '/account/sell',
        },
        ...customers.map((customer) => ({
          user: customer,
          type: 'order',
          title: `${shop} is back`,
          body: 'An order you had from this shop was cancelled while it was suspended. You can order again.',
          link: `/s/${user.sellerProfile.slug}`,
        })),
      ]);
  },

  async 'product.moderate'({ target, undo }, session) {
    const product = await Product.findById(target.id).populate('seller', 'isActive role sellerProfile.status').session(session);
    if (!product) throw gone('That product');
    if (!same({ isActive: product.isActive, isFeatured: product.isFeatured }, undo.after)) throw stale();
    if (undo.before.isActive && !(product.seller && isApprovedSeller(product.seller))) {
      throw new AppError(409, 'CONFLICT', "The seller's account isn't active, so this product can't be relisted.");
    }
    Object.assign(product, undo.before);
    if (product.isActive) product.unlistedBy = undefined;
    await product.save({ session });
  },

  async 'review.delete'({ undo }, session) {
    const { review } = undo;
    if (await Review.exists({ _id: review._id }).session(session)) throw stale();
    if (!(await User.exists({ _id: review.user }).session(session))) throw gone("The reviewer's account");
    // One review per person per product: they may have written a new one since.
    if (await Review.exists({ user: review.user, product: review.product }).session(session)) throw stale();
    await Review.collection.insertOne(review, { session });
    return () => recalcRatings([review]);
  },

  async 'coupon.create'({ target }, session) {
    const coupon = await Coupon.findById(target.id).session(session);
    if (!coupon) throw gone('That code');
    if (coupon.usedCount > 0) {
      throw new AppError(409, 'CONFLICT', 'Customers have used this code, so it cannot be removed. Turn it off instead.');
    }
    await Coupon.deleteOne({ _id: coupon._id }, { session });
  },

  async 'coupon.update'({ target, undo }, session) {
    const coupon = await Coupon.findById(target.id).session(session);
    if (!coupon) throw gone('That code');
    const now = Object.fromEntries(Object.keys(undo.after).map((k) => [k, coupon[k] ?? null]));
    if (!same(now, undo.after)) throw stale();
    for (const [k, v] of Object.entries(undo.before)) coupon[k] = v ?? undefined;
    await coupon.save({ session });
  },
};

// Hourly housekeeping: once the restore window has passed, a deleted account's saved copy (with its
// password hash and personal details) is erased; only the line of text stays in the log.
export async function purgeExpired(now = Date.now()) {
  const { modifiedCount } = await ActivityLog.updateMany(
    { action: 'user.delete', undoneAt: null, undoable: true, createdAt: { $lt: new Date(now - RESTORE_DAYS * DAY_MS) } },
    { $unset: { undo: 1 }, $set: { undoable: false } },
  );
  return modifiedCount;
}

export async function undoEntry(id, owner) {
  let afterCommit;
  const entry = await mongoose.connection.transaction(async (session) => {
    const found = await ActivityLog.findById(id).select('+undo').session(session);
    if (!found) throw notFound('That entry');
    if (!found.undoable || !UNDO[found.action]) throw new AppError(422, 'NOT_UNDOABLE', "This action can't be undone.");
    if (found.undoneAt) throw new AppError(409, 'CONFLICT', 'This was already undone.');
    afterCommit = await UNDO[found.action](found, session);
    Object.assign(found, { undoneAt: new Date(), undoneBy: owner._id, undoneByName: owner.name });
    // The restored account lives in users again; its copy (with the password hash) isn't kept twice.
    if (found.action === 'user.delete') found.undo = undefined;
    await found.save({ session });
    return found;
  });
  await afterCommit?.();
  entry.undo = undefined;
  return entry;
}
