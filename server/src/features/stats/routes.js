import { Router } from 'express';
import { requireApprovedSeller, requireAuth, requireRole } from '../../middleware/auth.js';
import * as stats from './controller.js';

const router = Router();
router.get('/seller/stats', requireAuth, requireApprovedSeller, stats.sellerStats);
router.get('/admin/stats', requireAuth, requireRole('admin'), stats.adminStats);

export default router;
