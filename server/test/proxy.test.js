import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/error.js';
import { requireProxy } from '../src/middleware/proxy.js';
import { useSeededDb } from './helpers.js';

useSeededDb();

const SECRET = 'a'.repeat(40);

// A bare app that echoes req.ip, to see what the rate limiters will key on.
function echoApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requireProxy(SECRET));
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  app.use(errorHandler);
  return app;
}

describe('proxy check', () => {
  afterEach(() => {
    delete process.env.PROXY_SECRET;
  });

  it('turns away requests that skipped the site', async () => {
    process.env.PROXY_SECRET = SECRET;
    const app = createApp();

    const missing = await request(app).get('/api/products');
    const wrong = await request(app).get('/api/products').set('x-proxy-secret', 'b'.repeat(40));
    const short = await request(app).get('/api/products').set('x-proxy-secret', 'a');

    for (const res of [missing, wrong, short]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DIRECT_ACCESS');
    }
  });

  it('serves requests carrying the secret, and leaves the health check open for the host', async () => {
    process.env.PROXY_SECRET = SECRET;
    const app = createApp();

    const viaSite = await request(app).get('/api/products').set('x-proxy-secret', SECRET);
    const health = await request(app).get('/api/health');

    expect(viaSite.status).toBe(200);
    expect(health.status).toBe(200);
  });

  it('is off when no secret is configured (local development)', async () => {
    const res = await request(createApp()).get('/api/products');

    expect(res.status).toBe(200);
  });

  it('uses the visitor IP from the site instead of a forged X-Forwarded-For', async () => {
    const res = await request(echoApp())
      .get('/ip')
      .set('x-proxy-secret', SECRET)
      .set('x-client-ip', '203.0.113.7')
      .set('x-forwarded-for', '198.51.100.1');

    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('ignores a visitor IP that is not an IP address', async () => {
    const res = await request(echoApp())
      .get('/ip')
      .set('x-proxy-secret', SECRET)
      .set('x-client-ip', 'not-an-ip')
      .set('x-forwarded-for', '198.51.100.1');

    expect(res.body.ip).toBe('198.51.100.1');
  });
});
