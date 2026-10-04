import { Router } from 'express';
import { requireApprovedSeller, requireArea, requireAuth } from '../../middleware/auth.js';
import * as returns from './controller.js';

const router = Router();
router.post('/orders/:id/returns', requireAuth, returns.createReturn);
router.get('/orders/:id/returns', requireAuth, returns.orderReturns);
router.get('/returns/sold', requireAuth, requireApprovedSeller, returns.soldReturns);
router.patch('/returns/:id/decision', requireAuth, requireApprovedSeller, returns.sellerDecide);
router.patch('/returns/:id/received', requireAuth, requireApprovedSeller, returns.markReceived);
router.patch('/returns/:id/escalate', requireAuth, returns.escalate);
router.get('/admin/returns', requireAuth, requireArea('orders'), returns.adminReturns);
router.patch('/admin/returns/:id', requireAuth, requireArea('orders'), returns.adminDecide);

export default router;
