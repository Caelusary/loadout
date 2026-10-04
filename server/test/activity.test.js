import { describe, expect, it } from 'vitest';
import { Order, Product, Review, User } from '../src/models/index.js';
import { productId, signIn, useSeededDb } from './helpers.js';
import { users } from '../src/seed/data.js';

useSeededDb();

const id = (key) => users[key]._id.toString();
const latest = async (agent) => (await agent.get('/api/admin/activity')).body.items[0];

describe('activity log and undo', () => {
  it("logs an admin's action, lets admins read it, and lets only the owner undo it", async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    const listed = await Product.countDocuments({ seller: id('glide'), isActive: true });
    expect(listed).toBeGreaterThan(0);

    await admin.patch(`/api/admin/users/${id('glide')}`).send({ isActive: false });
    expect(await Product.countDocuments({ seller: id('glide'), isActive: true })).toBe(0);

    const entry = await latest(admin);
    expect(entry).toMatchObject({ action: 'user.deactivate', actorName: 'Rhea Santos', undoable: true });
    expect(entry.summary).toMatch(/deactivated Andrea Lim/);
    expect(entry.undo).toBeUndefined(); // never sent: a deleted account's snapshot holds its password hash

    expect((await admin.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(403);
    const undone = await owner.post(`/api/admin/activity/${entry._id}/undo`);
    expect(undone.status).toBe(200);
    expect(undone.body.entry.undoneByName).toBe(users.owner.name);
    expect((await User.findById(id('glide'))).isActive).toBe(true);
    expect(await Product.countDocuments({ seller: id('glide'), isActive: true })).toBe(listed);

    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(409);
  });

  it('restores a deleted account with its password and reviews', async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    const reviews = await Review.countDocuments({ user: id('lea') });
    expect(reviews).toBeGreaterThan(0);
    // Accounts with open orders can't be deleted, so close Lea's first.
    await Order.updateMany({ user: id('lea'), status: { $ne: 'delivered' } }, { status: 'delivered' });

    expect((await admin.delete(`/api/admin/users/${id('lea')}`)).status).toBe(200);
    expect(await User.exists({ _id: id('lea') })).toBeNull();

    const entry = await latest(owner);
    expect(entry.action).toBe('user.delete');
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(200);
    expect(await Review.countDocuments({ user: id('lea') })).toBe(reviews);
    await signIn('lea'); // same password as before
  });

  it("refuses an undo once the thing has changed again", async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    await admin.patch(`/api/admin/products/${productId(2)}`).send({ isActive: false });
    const unlist = await latest(admin);
    await admin.patch(`/api/admin/products/${productId(2)}`).send({ isActive: true });

    const res = await owner.post(`/api/admin/activity/${unlist._id}/undo`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/changed since/);
  });

  it("logs an admin's order cancel but won't undo it", async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    const order = await Order.findOne({ status: { $in: ['placed', 'processing', 'shipped'] } });
    expect((await admin.patch(`/api/orders/${order._id}/cancel`)).status).toBe(200);

    const entry = await latest(owner);
    expect(entry).toMatchObject({ action: 'order.cancel', undoable: false });
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(422);
  });

  it('gives each admin only the areas the owner allows', async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    expect((await admin.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['coupons'] })).status).toBe(403); // owner only

    const set = await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['coupons'] });
    expect(set.body.user.adminPermissions).toEqual(['coupons']);
    expect((await admin.get('/api/admin/users')).status).toBe(403);
    expect((await admin.get('/api/admin/sellers')).status).toBe(403);
    expect((await admin.get('/api/admin/coupons')).status).toBe(200);
    expect((await admin.get('/api/admin/stats')).status).toBe(200); // the dashboard is always open
    expect((await admin.get('/api/admin/activity')).status).toBe(200);

    expect((await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['sneaky'] })).status).toBe(400);
    expect((await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: [], isActive: false })).status).toBe(400);

    await owner.post(`/api/admin/activity/${(await latest(owner))._id}/undo`);
    expect((await admin.get('/api/admin/users')).status).toBe(200);
  });
});
