import { Router } from 'express';
import { requireApprovedSeller, requireArea, requireAuth } from '../../middleware/auth.js';
import { passwordLimiter } from '../../middleware/limits.js';
import * as users from './controller.js';

const router = Router();
router.patch('/users/me', requireAuth, passwordLimiter, users.updateMe);
router.patch('/users/me/password', requireAuth, passwordLimiter, users.changePassword);
router.post('/users/me/seller-application', requireAuth, users.applyToSell);
router.patch('/users/me/shop', requireAuth, requireApprovedSeller, users.updateShop);
router.delete('/users/me', requireAuth, passwordLimiter, users.deleteMe);
router.get('/admin/users', requireAuth, requireArea('users'), users.listUsers);
router.patch('/admin/users/:id', requireAuth, requireArea('users'), users.updateUser);
router.delete('/admin/users/:id', requireAuth, requireArea('users'), users.deleteUser);
router.post('/admin/users/:id/reset-email', requireAuth, requireArea('users'), users.sendResetEmail);

export default router;
