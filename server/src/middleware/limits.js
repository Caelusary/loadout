import rateLimit from 'express-rate-limit';
import { AppError } from '../lib/AppError.js';

// Counts failed attempts per signed-in user (runs after requireAuth), so someone holding a stolen
// cookie can't guess the password, or a discount code, without limit. Successful requests don't count.
export const perUserFailures = ({ limit, message, skip = () => false, windowMs = 15 * 60 * 1000, countSuccess = false }) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: !countSuccess,
    skip: (req) => process.env.NODE_ENV === 'test' || skip(req),
    keyGenerator: (req) => req.user._id.toString(),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
  });

// Password checks outside sign-in: changing it, changing the email, deleting the account.
export const passwordLimiter = perUserFailures({
  limit: 10,
  message: 'Too many password attempts. Try again in 15 minutes.',
});

// Every upload counts, not just failed ones: files are stored as soon as they arrive, before any
// product uses them, so this caps how much one seller account can fill the storage.
export const uploadLimiter = perUserFailures({
  limit: 60,
  windowMs: 60 * 60 * 1000,
  countSuccess: true,
  message: 'That is a lot of uploads for one hour. Try again later.',
});

// A ceiling for the whole API per visitor, far above what browsing uses (a shop page makes a handful
// of requests), so a script hammering search or listings slows itself down instead of the database.
// In production req.ip is the visitor address Vercel vouches for (middleware/proxy.js).
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Slow down and try again in a minute.')),
});
