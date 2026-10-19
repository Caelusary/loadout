// Admin moderation: unlisting, relisting and featuring any shop's product, logged so the owner can undo it.
import mongoose from 'mongoose';
import { Product } from '../../models/index.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { record } from '../activity/service.js';
import { MAX_FEATURED } from './catalog.js';

export async function moderateProduct(req, res) {
  const product = await Product.findById(req.params.id).populate('seller', 'isActive role sellerProfile.status');
  if (!product) throw notFound('That product');
  const { isActive, isFeatured } = req.body ?? {};
  const before = { isActive: product.isActive, isFeatured: product.isFeatured, unlistedBy: product.unlistedBy };

  if (typeof isActive === 'boolean' && isActive !== product.isActive) {
    if (isActive) {
      const seller = product.seller;
      if (!seller?.isActive || seller.role !== 'seller' || seller.sellerProfile?.status !== 'approved') {
        throw new AppError(409, 'CONFLICT', "The seller's account isn't active, so this product can't be relisted.");
      }
      product.isActive = true;
      product.unlistedBy = undefined;
    } else {
      Object.assign(product, { isActive: false, unlistedBy: 'admin', isFeatured: false });
    }
  }

  if (typeof isFeatured === 'boolean' && isFeatured !== product.isFeatured) {
    if (isFeatured) {
      if (!product.isActive) throw new AppError(409, 'CONFLICT', 'Only listed products can be featured.');
      const featured = await Product.countDocuments({ isFeatured: true, _id: { $ne: product._id } });
      if (featured >= MAX_FEATURED) {
        throw new AppError(409, 'CONFLICT', `You can feature at most ${MAX_FEATURED} products. Unfeature one first.`);
      }
    }
    product.isFeatured = isFeatured;
  }

  const after = { isActive: product.isActive, isFeatured: product.isFeatured };
  if (after.isActive === before.isActive && after.isFeatured === before.isFeatured) return res.json({ product });
  const did = [
    after.isActive !== before.isActive && (after.isActive ? 'relisted' : 'unlisted'),
    after.isFeatured !== before.isFeatured && (after.isFeatured ? 'featured' : 'unfeatured'),
  ].filter(Boolean);
  await mongoose.connection.transaction(async (session) => {
    await product.save({ session });
    await record(
      req.user,
      {
        action: 'product.moderate',
        target: { kind: 'product', id: product._id, label: product.name },
        summary: `${did.join(' and ')} ${product.name}`,
        undo: { before, after },
      },
      session,
    );
  });
  res.json({ product });
}
