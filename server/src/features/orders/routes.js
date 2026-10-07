import { Router } from 'express';
import { requireApprovedSeller, requireArea, requireAuth } from '../../middleware/auth.js';
import { perUserFailures } from '../../middleware/limits.js';
import * as orders from './controller.js';

const router = Router();
// A checkout with a code counts its failures like the code preview does, so codes can't be guessed here.
const codeLimiter = perUserFailures({
  limit: 20,
  message: 'Too many code attempts. Try again in 15 minutes.',
  skip: (req) => !req.body?.couponCode,
});
router.post('/orders', requireAuth, codeLimiter, orders.createOrders);
router.get('/admin/orders', requireAuth, requireArea('orders'), orders.allOrders);
router.get('/orders/mine', requireAuth, orders.myOrders);
router.get('/orders/sold', requireAuth, requireApprovedSeller, orders.soldOrders);
router.get('/orders/:id', requireAuth, orders.getOrder);
router.patch('/orders/:id/cancel', requireAuth, orders.cancelOrder);
router.patch('/orders/:id/status', requireAuth, requireApprovedSeller, orders.advanceOrder);

export default router;
