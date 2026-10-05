import { Router } from 'express';
import { requireArea, requireAuth } from '../../middleware/auth.js';
import * as sellers from './controller.js';

const router = Router();
router.get('/admin/sellers', requireAuth, requireArea('sellers'), sellers.listSellers);
router.patch('/admin/sellers/:id', requireAuth, requireArea('sellers'), sellers.updateSeller);
router.get('/shops/:slug', sellers.getShop);

export default router;
