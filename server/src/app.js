import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { errorHandler, notFoundRoute } from './middleware/error.js';
import { apiLimiter } from './middleware/limits.js';
import { requireProxy } from './middleware/proxy.js';
import { UPLOAD_DIR, isCloudinaryEnabled } from './lib/storage.js';
import authRoutes from './features/auth/routes.js';
import userRoutes from './features/users/routes.js';
import sellerRoutes from './features/sellers/routes.js';
import productRoutes from './features/products/routes.js';
import orderRoutes from './features/orders/routes.js';
import reviewRoutes from './features/reviews/routes.js';
import statsRoutes from './features/stats/routes.js';
import couponRoutes from './features/coupons/routes.js';
import notificationRoutes from './features/notifications/routes.js';
import wishlistRoutes from './features/wishlist/routes.js';
import cartRoutes from './features/cart/routes.js';
import activityRoutes from './features/activity/routes.js';
import returnsRoutes from './features/returns/routes.js';

export function createApp() {
  const app = express();
  const production = process.env.NODE_ENV === 'production';

  // Only for requests the proxy check doesn't cover (health checks, local dev); behind Vercel,
  // requireProxy sets req.ip from the visitor address Vercel passes along.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  // Product lists are repetitive JSON, so gzip shrinks them to a fraction on slow mobile connections.
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') app.use(morgan(production ? 'combined' : 'dev'));

  // Render routes traffic by this, so it has to fail when the database is down, not just when Node is.
  // It sits before the proxy check because Render's own health checks don't come through Vercel.
  app.get('/api/health', (req, res) => {
    const ok = mongoose.connection.readyState === 1;
    res.status(ok ? 200 : 503).json({ ok });
  });
  if (process.env.PROXY_SECRET) app.use('/api', requireProxy(process.env.PROXY_SECRET));
  if (!isCloudinaryEnabled()) app.use('/api/files', express.static(UPLOAD_DIR, { index: false }));
  app.use('/api', apiLimiter);
  for (const routes of [
    authRoutes,
    userRoutes,
    sellerRoutes,
    productRoutes,
    orderRoutes,
    reviewRoutes,
    statsRoutes,
    couponRoutes,
    notificationRoutes,
    wishlistRoutes,
    cartRoutes,
    activityRoutes,
    returnsRoutes,
  ]) {
    app.use('/api', routes);
  }

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}
