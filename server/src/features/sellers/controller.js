import mongoose from 'mongoose';
import { Product, User } from '../../models/index.js';
import { SELLER_STATUSES } from '../../models/User.js';
import { invalid, notFound } from '../../lib/AppError.js';
import { pageParams, paginate } from '../../lib/request.js';
import { unlistSellerProducts } from '../products/service.js';
import { notify } from '../notifications/service.js';
import { record } from '../activity/service.js';
import { cancelOrders, noticesForCancelled, releaseCouponsAfterCommit } from '../orders/service.js';

export async function listSellers(req, res) {
  const filter = { sellerProfile: { $exists: true } };
  if (SELLER_STATUSES.includes(req.query.status)) filter['sellerProfile.status'] = req.query.status;
  res.json(
    await paginate(User, filter, pageParams(req.query), (q) => q.sort({ 'sellerProfile.appliedAt': -1 })),
  );
}

export async function updateSeller(req, res) {
  const { status } = req.body ?? {};
  if (!['approved', 'suspended'].includes(status)) {
    throw invalid({ status: 'Status must be approved or suspended.' });
  }
  const target = await User.findById(req.params.id);
 
  if (!target?.sellerProfile || target.role === 'admin') throw notFound('That seller');

  const wasPending = target.role !== 'seller';
  const before = { status: target.sellerProfile.status, reviewedAt: target.sellerProfile.reviewedAt, role: target.role };
  const shop = target.sellerProfile.shopName;
  const cancelled = await mongoose.connection.transaction(async (session) => {
    target.sellerProfile.status = status;
    target.sellerProfile.reviewedAt = new Date();
    if (status === 'approved') target.role = 'seller';
    await target.save({ session });
    const unlisted = status === 'suspended' ? await unlistSellerProducts(target._id, session) : [];
 
    const orders =
      status === 'suspended' && !wasPending
        ? await cancelOrders({ seller: target._id }, { by: 'admin', reason: `${shop} was suspended.` }, session)
        : [];
    await record(
      req.user,
      {
        action: status === 'approved' ? 'seller.approve' : 'seller.suspend',
        target: { kind: 'seller', id: target._id, label: shop },
        summary: status === 'approved' ? `approved ${shop}` : wasPending ? `declined ${shop}'s application` : `suspended ${shop}`,
        undo: { before, unlisted, cancelled: orders.map((o) => ({ order: o._id, user: o.user })) },
      },
      session,
    );
    return orders;
  });
  await releaseCouponsAfterCommit(cancelled);
  await noticesForCancelled(cancelled);
  await notify({
    user: target._id,
    type: 'seller',
    title: status === 'approved' ? `${target.sellerProfile.shopName} is approved` : `${target.sellerProfile.shopName} was not approved`,
    body:
      status === 'approved'
        ? 'You can list products now from the Seller Center.'
        : wasPending
          ? 'Your application was declined. Contact an admin if you think this is a mistake.'
          : 'Your shop is suspended and its products are unlisted.',
    link: status === 'approved' ? '/seller' : '/account',
  });
  res.json({ user: target });
}

export async function getShop(req, res) {
  const owner = await User.findOne({
    'sellerProfile.slug': req.params.slug,
    'sellerProfile.status': 'approved',
    role: 'seller',
    isActive: true,
  });
  if (!owner) throw notFound('That shop');
  const products = await Product.find({ seller: owner._id, isActive: true })
    .sort({ createdAt: -1 })
    .populate('seller', 'sellerProfile.shopName sellerProfile.slug');
  const { shopName, slug, bio, logoUrl } = owner.sellerProfile;
  res.json({ shop: { shopName, slug, bio, logoUrl, since: owner.createdAt }, products });
}
