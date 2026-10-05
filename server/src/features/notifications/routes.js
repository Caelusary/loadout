import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as notifications from './controller.js';

const router = Router();
router.get('/notifications', requireAuth, notifications.listNotifications);
router.patch('/notifications/read-all', requireAuth, notifications.readAll);
router.patch('/notifications/:id/read', requireAuth, notifications.readNotification);

export default router;
