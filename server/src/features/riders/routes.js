import { Router } from 'express';
import { requireArea, requireAuth, requireRole } from '../../middleware/auth.js';
import * as riders from './controller.js';

const rider = [requireAuth, requireRole('rider')];
const admin = [requireAuth, requireArea('users')];
const router = Router();
router.get('/rider/profile', ...rider, riders.myProfile);
router.patch('/rider/profile', ...rider, riders.updateMyProfile);
router.post('/rider/reports/:id/reply', ...rider, riders.replyToReport);
router.post('/deliveries/:id/decline', ...rider, riders.declineDelivery);
router.post('/orders/:id/rider-rating', requireAuth, riders.rateRider);
router.post('/orders/:id/rider-report', requireAuth, riders.reportRider);
router.get('/admin/riders/:id', ...admin, riders.getRider);
router.patch('/admin/riders/:id/hold', ...admin, riders.setHold);
router.patch('/admin/riders/:id/vehicle-request', ...admin, riders.decideVehicleRequest);
router.get('/admin/rider-feedback', ...admin, riders.feedbackQueue);
router.patch('/admin/rider-feedback/:id', ...admin, riders.markReviewed);

export default router;
