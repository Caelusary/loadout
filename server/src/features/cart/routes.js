import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as cart from './controller.js';

// Customers and sellers shop; admins don't have a cart.
const shopper = [requireAuth, requireRole('customer', 'seller')];
const router = Router();
router.get('/cart', ...shopper, cart.getCart);
router.post('/cart/:productId', ...shopper, cart.addToCart);
router.put('/cart/:productId', ...shopper, cart.setCartQty);
router.delete('/cart/:productId', ...shopper, cart.removeFromCart);
router.delete('/cart', ...shopper, cart.clearCart);

export default router;
