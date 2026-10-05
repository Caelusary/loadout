import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as wishlist from './controller.js';

const shopper = [requireAuth, requireRole('customer', 'seller')];
const router = Router();
router.get('/wishlist', ...shopper, wishlist.getWishlist);
router.put('/wishlist/:productId', ...shopper, wishlist.addToWishlist);
router.delete('/wishlist/:productId', ...shopper, wishlist.removeFromWishlist);

export default router;
