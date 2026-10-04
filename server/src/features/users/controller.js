import mongoose from 'mongoose';
import { Review, User } from '../../models/index.js';
import { ADMIN_AREAS, ROLES } from '../../models/User.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { escapeRegex, pageParams, paginate, pick, slugify } from '../../lib/request.js';
import { endOtherSessions, endSession } from '../../middleware/auth.js';
import { unlistSellerProducts } from '../products/service.js';
import { sendResetLink } from '../auth/reset.js';
import { noticesForCancelled, releaseCouponsAfterCommit } from '../orders/service.js';
import { assertCanClose, assertNothingOpen, cancelClosedAccountOrders, openOrders, plural, REAPPLY_WAIT_MS } from './service.js';
import { record, userLabel } from '../activity/service.js';

export async function updateMe(req, res) {
  const data = pick(req.body, ['name', 'email', 'shippingAddress']);
  if (data.shippingAddress === null) data.shippingAddress = undefined;
  // The email is how an account is signed into, so changing it takes the current password.
  if (data.email !== undefined && String(data.email).toLowerCase().trim() !== req.user.email) {
    await checkPassword(req.user._id, req.body.currentPassword, 'currentPassword');
  }
  Object.assign(req.user, data);
  await req.user.save();
  res.json({ user: req.user });
}

async function checkPassword(userId, password, field) {
  const user = await User.findById(userId).select('+password');
  if (!password || !(await user.comparePassword(String(password)))) {
    throw invalid({ [field]: field === 'currentPassword' ? 'Current password is incorrect.' : 'Password is incorrect.' });
  }
  return user;
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = await checkPassword(req.user._id, currentPassword, 'currentPassword');
  if (!newPassword || String(newPassword).length < 8) {
    throw invalid({ newPassword: 'New password must be at least 8 characters.' });
  }
  if (Buffer.byteLength(String(newPassword), 'utf8') > 72) throw invalid({ newPassword: 'New password must be at most 72 characters.' });
  if (String(newPassword) === String(currentPassword)) {
    throw invalid({ newPassword: 'Choose a password different from the current one.' });
  }
  user.password = String(newPassword);
  await user.save();
  // Anyone else signed in with the old password is signed out; this device stays signed in.
  await endOtherSessions(user._id, req.sessionId);
  res.json({ ok: true, user });
}

export async function applyToSell(req, res) {
  if (req.user.role !== 'customer') throw new AppError(403, 'FORBIDDEN', 'Only customer accounts can apply to sell.');
  // A declined application (still a customer, status suspended) can be sent again after a week.
  const previous = req.user.sellerProfile;
  if (previous) {
    if (previous.status !== 'suspended') throw new AppError(409, 'CONFLICT', 'You have already applied to sell.');
    const waitUntil = new Date(new Date(previous.reviewedAt ?? previous.appliedAt).getTime() + REAPPLY_WAIT_MS);
    if (waitUntil > new Date()) {
      throw new AppError(409, 'CONFLICT', `You can apply again on ${waitUntil.toLocaleDateString('en-PH', { dateStyle: 'long' })}.`);
    }
  }
  const { shopName, bio } = pick(req.body, ['shopName', 'bio']);
  req.user.sellerProfile = {
    shopName,
    bio,
    // Placeholder only matters when shopName is invalid, and then validation fails on shopName anyway.
    slug: slugify(shopName ?? '') || 'shop',
    status: 'pending',
    appliedAt: new Date(),
  };
  await req.user.save();
  res.status(201).json({ user: req.user });
}

export async function listUsers(req, res) {
  const filter = {};
  if (ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const re = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }
  res.json(await paginate(User, filter, pageParams(req.query), (q) => q.sort({ createdAt: -1, _id: -1 })));
}

// Admins manage customers and sellers; only the owner manages admins; nobody manages the owner.
async function loadOtherUser(req) {
  const target = await User.findById(req.params.id);
  if (!target) throw notFound('That user');
  if (target._id.equals(req.user._id)) throw new AppError(409, 'CONFLICT', 'You cannot change your own account here.');
  if (target.isOwner) throw new AppError(403, 'FORBIDDEN', "The owner's account can't be changed.");
  if (target.role === 'admin' && !req.user.isOwner)
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can change admin accounts.');
  return target;
}

// Exactly one change per request, so each one is its own entry in the activity log.
function readChange(body) {
  const sent = ['isActive', 'role', 'permissions'].filter((k) => body?.[k] !== undefined);
  if (body?.cancelOrders !== undefined && body.isActive !== false) {
    throw invalid({ cancelOrders: 'Orders can only be cancelled when deactivating an account.' });
  }
  if (sent.length !== 1) throw invalid({ isActive: 'Send one of isActive, role or permissions.' });
  const [kind] = sent;
  const value = body[kind];
  if (kind === 'isActive' && typeof value !== 'boolean') throw invalid({ isActive: 'isActive must be true or false.' });
  if (kind === 'role' && !['admin', 'customer'].includes(value)) throw invalid({ role: 'Role must be admin or customer.' });
  if (kind === 'permissions' && !(Array.isArray(value) && value.every((a) => ADMIN_AREAS.includes(a)))) {
    throw invalid({ permissions: `Permissions must be a list of: ${ADMIN_AREAS.join(', ')}.` });
  }
  return { kind, value };
}

// The owner makes a customer an admin (with every area to start), or an admin a customer again.
function changeRole(target, role) {
  if (role === 'admin') {
    if (target.role !== 'customer') throw invalid({ role: 'Only customer accounts can be made admins.' });
    if (target.sellerProfile) throw invalid({ role: 'This customer has applied to sell, so they cannot be made an admin.' });
    const cart = target.cart.map((line) => line.toObject());
    Object.assign(target, { role, adminPermissions: [...ADMIN_AREAS], cart: [] }); // admins don't shop
    return { action: 'user.promote', summary: `made ${target.name} an admin`, undo: { cart } };
  }
  if (target.role !== 'admin') throw invalid({ role: 'Only admins can be made customers again.' });
  const permissions = [...(target.adminPermissions ?? [])];
  Object.assign(target, { role, adminPermissions: undefined });
  return { action: 'user.demote', summary: `removed ${target.name} as admin`, undo: { permissions } };
}

function changePermissions(target, areas) {
  if (target.role !== 'admin') throw invalid({ permissions: 'Only admins have permissions.' });
  const before = [...(target.adminPermissions ?? [])];
  const after = ADMIN_AREAS.filter((a) => areas.includes(a));
  target.adminPermissions = after;
  const names = { users: 'users', sellers: 'sellers', products: 'products', orders: 'orders', coupons: 'discount codes' };
  const list = after.length ? after.map((a) => names[a]).join(', ') : 'nothing but the dashboard';
  return { action: 'user.permissions', summary: `set ${target.name}'s access to ${list}`, undo: { before, after } };
}

export async function updateUser(req, res) {
  const { kind, value } = readChange(req.body);
  if (kind !== 'isActive' && !req.user.isOwner) throw new AppError(403, 'FORBIDDEN', 'Only the owner can make or remove admins.');
  const target = await loadOtherUser(req);
  if (kind === 'isActive' && target.isActive === value) return res.json({ user: target }); // nothing to change or log
  // Deactivating asks the admin whether to cancel the account's unshipped orders (see openOrders).
  const cancelling = kind === 'isActive' && !value && req.body.cancelOrders === true;
  const cancelled = await mongoose.connection.transaction(async (session) => {
    let entry;
    if (kind === 'role') entry = changeRole(target, value);
    else if (kind === 'permissions') entry = changePermissions(target, value);
    else {
      target.isActive = value;
      // A deactivated account's cookies must not come back to life if it's reactivated later.
      if (!value) target.set('sessions', []);
      entry = { action: value ? 'user.activate' : 'user.deactivate', summary: `${value ? 'activated' : 'deactivated'} ${target.name}` };
    }
    await target.save({ session });
    if (kind === 'isActive' && !value && target.role === 'seller') {
      entry.undo = { unlisted: await unlistSellerProducts(target._id, session) };
    }
    const orders = cancelling ? await cancelClosedAccountOrders(target._id, session) : [];
    if (orders.length) entry.summary += ` and cancelled ${plural(orders.length, 'unshipped order')}`;
    await record(req.user, { ...entry, target: { kind: 'user', id: target._id, label: userLabel(target) } }, session);
    return orders;
  });
  await releaseCouponsAfterCommit(cancelled);
  await noticesForCancelled(cancelled);
  res.json({ user: target, cancelled: cancelled.length });
}

// Kept whole in the activity log (account, password hash and reviews), so the owner can restore it.
export async function deleteUser(req, res) {
  const target = await loadOtherUser(req);
  const cancelling = req.query.cancelOrders === '1';
  assertCanClose(await openOrders(target._id), cancelling, 'This account has');

  const reviewed = await Review.distinct('product', { user: target._id });
  const cancelled = await mongoose.connection.transaction(async (session) => {
    const orders = cancelling ? await cancelClosedAccountOrders(target._id, session) : [];
    await assertNothingOpen(target._id, session);
    const account = await User.collection.findOne({ _id: target._id }, { session });
    account.sessions = []; // a restored account signs in afresh; old cookies stay dead
    const reviews = await Review.collection.find({ user: target._id }, { session }).toArray();
    await Review.deleteMany({ user: target._id }, { session });
    const unlisted = await unlistSellerProducts(target._id, session);
    await User.deleteOne({ _id: target._id }, { session });
    await record(
      req.user,
      {
        action: 'user.delete',
        target: { kind: 'user', id: target._id, label: userLabel(target) },
        summary: `deleted ${target.name}'s account${orders.length ? ` and cancelled ${plural(orders.length, 'unshipped order')}` : ''}`,
        undo: { user: account, reviews, unlisted },
      },
      session,
    );
    return orders;
  });
  // deleteMany skips the Review hooks, so recompute the affected ratings here.
  await Promise.all(reviewed.map((productId) => Review.calcRating(productId)));
  await releaseCouponsAfterCommit(cancelled);
  await noticesForCancelled(cancelled, { skip: target._id });
  res.json({ deleted: true, cancelled: cancelled.length });
}

// Admins help a locked-out user by emailing the reset link to the user's own address: the admin never
// sees a password, so they can't sign in as them. Logged; nothing to undo.
export async function sendResetEmail(req, res) {
  const target = await loadOtherUser(req);
  if (!target.isActive) throw new AppError(409, 'CONFLICT', 'Activate the account first.');
  if (!(await sendResetLink(target))) {
    throw new AppError(429, 'RATE_LIMITED', 'A reset email went to this account in the last 2 minutes. Wait a moment first.');
  }
  await record(req.user, {
    action: 'user.reset-email',
    target: { kind: 'user', id: target._id, label: userLabel(target) },
    summary: `sent ${target.name} a password reset email`,
    undoable: false,
  });
  res.json({ ok: true });
}

// People close their own account. It takes their password, and unlike an admin's delete nothing is
// kept for restoring: they asked to leave. Admins ask the owner instead.
export async function deleteMe(req, res) {
  if (req.user.role === 'admin') throw new AppError(403, 'FORBIDDEN', 'Admin accounts are closed by the owner.');
  await checkPassword(req.user._id, req.body?.password, 'password');
  const cancelling = req.body?.cancelOrders === true;
  assertCanClose(await openOrders(req.user._id), cancelling, 'You have');

  const reviewed = await Review.distinct('product', { user: req.user._id });
  const cancelled = await mongoose.connection.transaction(async (session) => {
    const orders = cancelling ? await cancelClosedAccountOrders(req.user._id, session, { self: true }) : [];
    await assertNothingOpen(req.user._id, session);
    await Review.deleteMany({ user: req.user._id }, { session });
    await unlistSellerProducts(req.user._id, session);
    await User.deleteOne({ _id: req.user._id }, { session });
    return orders;
  });
  await Promise.all(reviewed.map((productId) => Review.calcRating(productId)));
  await releaseCouponsAfterCommit(cancelled);
  await noticesForCancelled(cancelled, { skip: req.user._id });
  await endSession(req, res);
  res.json({ deleted: true, cancelled: cancelled.length });
}
