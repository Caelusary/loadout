import { describe, expect, it } from 'vitest';
import { User } from '../src/models/index.js';
import { productId, signIn, useSeededDb } from './helpers.js';
import { users } from '../src/seed/data.js';

useSeededDb();

const id = (key) => users[key]._id.toString();

describe('owner and admins', () => {
  it('keeps admins off the owner', async () => {
    const admin = await signIn('admin');
    expect((await admin.patch(`/api/admin/users/${id('owner')}`).send({ isActive: false })).status).toBe(403);
    expect((await admin.delete(`/api/admin/users/${id('owner')}`)).status).toBe(403);
    // Admins still manage customers, but can't hand out admin.
    expect((await admin.patch(`/api/admin/users/${id('lea')}`).send({ isActive: false })).status).toBe(200);
    expect((await admin.patch(`/api/admin/users/${id('paolo')}`).send({ role: 'admin' })).status).toBe(403);
    expect((await User.findById(id('paolo'))).role).toBe('customer');
  });

  it('lets the owner make, deactivate and remove admins', async () => {
    const owner = await signIn('owner');
    const paolo = await signIn('paolo');
    await paolo.post(`/api/cart/${productId(2)}`).send({ qty: 1 });

    const promoted = await owner.patch(`/api/admin/users/${id('paolo')}`).send({ role: 'admin' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.user.role).toBe('admin');
    expect((await User.findById(id('paolo'))).cart).toHaveLength(0);
    // Takes effect on Paolo's very next request: admin pages open, the cart closes.
    expect((await paolo.get('/api/admin/stats')).status).toBe(200);
    expect((await paolo.get('/api/cart')).status).toBe(403);

    // The new admin can't touch the admin who was there before them.
    expect((await paolo.patch(`/api/admin/users/${id('admin')}`).send({ isActive: false })).status).toBe(403);

    expect((await owner.patch(`/api/admin/users/${id('admin')}`).send({ isActive: false })).body.user.isActive).toBe(false);
    expect((await owner.patch(`/api/admin/users/${id('paolo')}`).send({ role: 'customer' })).body.user.role).toBe('customer');
    expect((await paolo.get('/api/admin/stats')).status).toBe(403);
  });

  it('only promotes plain customers, and nobody can change the owner', async () => {
    const owner = await signIn('owner');
    const bad = async (key, body) => {
      const res = await owner.patch(`/api/admin/users/${id(key)}`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.fields.role).toBeTruthy();
    };
    await bad('northpaw', { role: 'admin' }); // a seller
    await bad('coilworks', { role: 'admin' }); // applied to sell
    await bad('mika', { role: 'customer' }); // not an admin
    await bad('mika', { role: 'owner' });

    expect((await owner.patch(`/api/admin/users/${id('owner')}`).send({ isActive: false })).status).toBe(409); // self
    await expect(User.create({ name: 'Second Owner', email: 'two@loadout.test', password: 'password123', role: 'admin', isOwner: true })).rejects.toThrow(/duplicate key/);
  });
});
