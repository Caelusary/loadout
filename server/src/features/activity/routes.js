import { Router } from 'express';
import { requireAuth, requireOwner, requireRole } from '../../middleware/auth.js';
import * as activity from './controller.js';

const router = Router();
router.get('/admin/activity', requireAuth, requireRole('admin'), activity.listActivity);
router.post('/admin/activity/:id/undo', requireAuth, requireOwner, activity.undoActivity);

export default router;
