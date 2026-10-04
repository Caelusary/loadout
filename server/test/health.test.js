import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app, useSeededDb } from './helpers.js';

useSeededDb();

afterEach(() => vi.restoreAllMocks());

describe('health check', () => {
  it('reports healthy while the database is connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('fails when the database connection is down, so the host stops routing to it', async () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false });
  });
});
