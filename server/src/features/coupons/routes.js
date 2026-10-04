import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../lib/AppError.js';
import { requireArea, requireAuth } from '../../middleware/auth.js';
import * as coupons from './controller.js';

// Stops scripted code guessing: only failed attempts count, per signed-in user.
const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.user._id.toString(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many code attempts. Try again in 15 minutes.')),
});

const router = Router();
router.post('/coupons/preview', requireAuth, previewLimiter, coupons.previewCoupon);
router.get('/admin/coupons', requireAuth, requireArea('coupons'), coupons.listCoupons);
router.post('/admin/coupons', requireAuth, requireArea('coupons'), coupons.createCoupon);
router.patch('/admin/coupons/:id', requireAuth, requireArea('coupons'), coupons.updateCoupon);

export default router;
