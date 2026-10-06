import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { AppError } from '../lib/AppError.js';

// In production the API only answers requests that came through the Vercel site. Vercel's routing
// middleware (client/middleware.js) stamps each /api request with PROXY_SECRET and the visitor's IP;
// anything without the secret went straight to the Render URL and is turned away. That also makes
// req.ip trustworthy: it comes from Vercel, not from a header a direct caller could forge, so the
// rate limiters count real visitors instead of Render's load balancers.
export function requireProxy(secret) {
  const expected = Buffer.from(secret);
  return (req, res, next) => {
    const given = Buffer.from(req.get('x-proxy-secret') ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return next(new AppError(403, 'DIRECT_ACCESS', 'Use the Loadout website to reach this API.'));
    }
    const visitor = req.get('x-client-ip');
    if (visitor && isIP(visitor)) Object.defineProperty(req, 'ip', { value: visitor, configurable: true });
    next();
  };
}
