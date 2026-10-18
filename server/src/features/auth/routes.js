import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../lib/AppError.js';
import { optionalAuth } from '../../middleware/auth.js';
import * as auth from './controller.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again in 15 minutes.')),
});

// Slows scripted sign-ups (fresh accounts would otherwise each get a code's one use).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many new accounts from this network. Try again later.')),
});

// Reset emails go to real inboxes, so asking for them is limited per network.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many reset requests. Try again in 15 minutes.')),
});

const router = Router();
router.post('/auth/register', registerLimiter, auth.register);
router.post('/auth/login', loginLimiter, auth.login);
// No auth guard: logging out must also clear a stale or invalid cookie.
router.post('/auth/logout', auth.logout);
// Guests get { user: null } with a 200, so a signed-out page load doesn't log a 401 error in the console.
router.get('/auth/me', optionalAuth, auth.me);
router.post('/auth/forgot-password', resetLimiter, auth.forgotPassword);
router.post('/auth/reset-password', loginLimiter, auth.resetPassword);

export default router;
