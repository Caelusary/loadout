import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as deliveries from './controller.js';

const rider = [requireAuth, requireRole('rider')];
const router = Router();
router.get('/deliveries', ...rider, deliveries.myDeliveries);
router.patch('/deliveries/:id', ...rider, deliveries.advanceDelivery);

export default router;
