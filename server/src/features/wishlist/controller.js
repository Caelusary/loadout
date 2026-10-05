import { Product, User } from '../../models/index.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';

const SELLER_FIELDS = 'sellerProfile.shopName sellerProfile.slug';
const MAX_ITEMS = 100;

// Unlisted products stay saved (they may come back) but aren't shown until they're active again.
export async function getWishlist(req, res) {
  const ids = req.user.wishlist ?? [];
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).populate('seller', SELLER_FIELDS);
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  // Newest saved first.
  const items = [...ids].reverse().map((id) => byId.get(id.toString())).filter(Boolean);
  res.json({ items, ids });
}

export async function addToWishlist(req, res) {
  const { productId } = req.params;
  if (!isId(productId) || !(await Product.exists({ _id: productId, isActive: true }))) throw notFound('That product');
  // $addToSet makes a double click harmless; the size check keeps the list bounded.
  const updated = await User.findOneAndUpdate(
    { _id: req.user._id, [`wishlist.${MAX_ITEMS - 1}`]: { $exists: false } },
    { $addToSet: { wishlist: productId } },
    { new: true },
  );
  if (!updated) throw new AppError(422, 'WISHLIST_FULL', `Your wishlist can hold ${MAX_ITEMS} products. Remove some to add more.`);
  res.json({ ids: updated.wishlist });
}

export async function removeFromWishlist(req, res) {
  if (!isId(req.params.productId)) throw notFound('That product');
  const updated = await User.findByIdAndUpdate(req.user._id, { $pull: { wishlist: req.params.productId } }, { new: true });
  res.json({ ids: updated.wishlist });
}
