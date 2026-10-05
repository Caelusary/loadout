import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import * as reviews from './controller.js';

const router = Router();
router.get('/products/:id/reviews', optionalAuth, reviews.listReviews);
router.post('/products/:id/reviews', requireAuth, reviews.createReview);
router.patch('/reviews/:id', requireAuth, reviews.updateReview);
router.delete('/reviews/:id', requireAuth, reviews.deleteReview);

export default router;
