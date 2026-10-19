import { Router } from 'express';
import multer from 'multer';
import { invalid } from '../../lib/AppError.js';
import { optionalAuth, requireApprovedSeller, requireAuth } from '../../middleware/auth.js';
import { reviewPhotoLimiter } from '../../middleware/limits.js';
import * as reviews from './controller.js';

// One photo per request, images only; the controller holds it to 2 MB and checks the real file type.
const photoFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (req, file, cb) =>
    /\.(jpe?g|png|webp)$/i.test(file.originalname) ? cb(null, true) : cb(invalid({ file: 'Upload a JPG, PNG or WebP photo.' })),
}).single('file');

const router = Router();
router.get('/products/:id/reviews', optionalAuth, reviews.listReviews);
router.post('/products/:id/reviews', requireAuth, reviews.createReview);
router.post('/reviews/photos', requireAuth, reviewPhotoLimiter, photoFile, reviews.uploadPhoto);
router.patch('/reviews/:id', requireAuth, reviews.updateReview);
router.delete('/reviews/:id', requireAuth, reviews.deleteReview);
router.put('/reviews/:id/reply', requireAuth, reviews.replyToReview);
router.put('/reviews/:id/vote', requireAuth, reviews.voteReview);
router.delete('/reviews/:id/reply', requireAuth, reviews.deleteReply);
router.get('/seller/reviews', requireAuth, requireApprovedSeller, reviews.shopReviews);

export default router;
