import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models/index.js';
import { app, useSeededDb } from './helpers.js';

useSeededDb();

describe('auth', () => {
  it('registers a customer even when the body asks for admin', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Bea Tan', email: 'bea@loadout.test', password: 'longenough', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
    expect(res.body.user.password).toBeUndefined();
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('bea@loadout.test');
  });

  it('treats a request without the cookie as a guest', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns per-field messages for invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'name', 'password']);
  });

  it('rejects a duplicate email with a field error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Copy', email: 'mika@loadout.test', password: 'longenough' });

    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toMatch(/already exists/);
  });
});

describe('login', () => {
  const login = (body) => request(app).post('/api/auth/login').send(body);

  it('gives a wrong password and an unknown email the same 401, with no session cookie', async () => {
    const wrong = await login({ email: 'mika@loadout.test', password: 'not-the-password' });
    const unknown = await login({ email: 'ghost@loadout.test', password: 'password123' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Email or password is incorrect.');
      expect(res.headers['set-cookie']?.some((c) => c.startsWith('loadout_token=') && !/Expires=Thu, 01 Jan 1970/.test(c)) ?? false).toBe(false);
    }
  });

  it('accepts a differently cased, padded email', async () => {
    expect((await login({ email: '  MIKA@loadout.test ', password: 'password123' })).status).toBe(200);
  });

  it('turns away a deactivated account even with the right password', async () => {
    await User.updateOne({ email: 'mika@loadout.test' }, { isActive: false });
    try {
      const res = await login({ email: 'mika@loadout.test', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/deactivated/);
    } finally {
      await User.updateOne({ email: 'mika@loadout.test' }, { isActive: true });
    }
  });

  it('answers missing or non-string credentials with 400/401, never a crash', async () => {
    const missing = await login({});
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.error.fields).sort()).toEqual(['email', 'password']);
    const injected = await login({ email: { $ne: null }, password: { $ne: null } });
    expect(injected.status).toBe(401);
  });
});
