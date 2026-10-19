import { Router } from 'express';
import multer from 'multer';
import { invalid } from '../../lib/AppError.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { proofPhotoLimiter, retryDayLimiter } from '../../middleware/limits.js';
import * as attempts from './attempts.js';
import * as deliveries from './controller.js';

// One photo per request, images only; the controller holds it to 2 MB and checks the real file type.
const photoFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (req, file, cb) =>
    /\.(jpe?g|png|webp)$/i.test(file.originalname) ? cb(null, true) : cb(invalid({ file: 'Upload a JPG, PNG or WebP photo.' })),
}).single('file');

const rider = [requireAuth, requireRole('rider')];
const router = Router();
router.get('/deliveries', ...rider, deliveries.myDeliveries);
router.post('/deliveries/proof', ...rider, proofPhotoLimiter, photoFile, deliveries.uploadProof);
router.patch('/deliveries/:id', ...rider, deliveries.advanceDelivery);
router.post('/deliveries/:id/missed', ...rider, attempts.missedDelivery);
// The buyer's side of a missed delivery.
router.patch('/orders/:id/retry-day', requireAuth, retryDayLimiter, attempts.pickRetryDay);
router.post('/orders/:id/attempt-dispute', requireAuth, attempts.disputeAttempt);

export default router;
