import { describe, expect, it } from 'vitest';
import { ActivityLog, Notification, Order, User } from '../src/models/index.js';
import { ON_THE_WAY } from '../src/models/Order.js';
import { users } from '../src/seed/data.js';
import { riderStep, signIn, useSeededDb } from './helpers.js';

useSeededDb();

// Ramon, with nothing on the way (his open orders go to Joy), so he's free to ask for a change.
async function freeRider() {
  await Order.updateMany({ rider: users.ramon._id, status: { $in: ON_THE_WAY } }, { rider: users.joy._id });
  return User.findById(users.ramon._id).lean();
}

describe('vehicle changes', () => {
  it('keeps the current vehicle until an admin approves, and logs every step', async () => {
    const before = (await freeRider()).riderProfile;
    const ramon = await signIn('ramon');

    const ask = await ramon
      .patch('/api/rider/profile')
      .send({ vehicle: 'car', plate: 'abc 1234', phone: before.phone });
    expect(ask.status).toBe(200);
    expect(ask.body.requested).toBe(true);
    expect(ask.body.profile).toMatchObject({ vehicle: before.vehicle, plate: before.plate });
    expect(ask.body.profile.vehicleRequest).toMatchObject({ vehicle: 'car', plate: 'ABC 1234' });
    expect(await Notification.exists({ title: /Ramon Aquino asked to change their vehicle/ })).toBeTruthy();

    // Sending the same request again doesn't ping the admins twice.
    const pinged = await Notification.countDocuments({ title: /Ramon Aquino asked to change/ });
    expect(
      (await ramon.patch('/api/rider/profile').send({ vehicle: 'car', plate: 'ABC 1234' })).body.requested,
    ).toBe(false);
    expect(await Notification.countDocuments({ title: /Ramon Aquino asked to change/ })).toBe(pinged);

    const admin = await signIn('admin');
    const ok = await admin
      .patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`)
      .send({ action: 'approve' });
    expect(ok.status).toBe(200);
    const after = (await User.findById(users.ramon._id).lean()).riderProfile;
    expect(after).toMatchObject({ vehicle: 'car', plate: 'ABC 1234' });
    expect(after.vehicleRequest).toBeUndefined();
    expect(
      await Notification.exists({ user: users.ramon._id, title: 'Your vehicle change was approved' }),
    ).toBeTruthy();

    const log = await ActivityLog.find({ 'target.id': users.ramon._id }).lean();
    expect(log.map((e) => e.action)).toEqual(
      expect.arrayContaining(['rider.profile', 'rider.vehicle-approve']),
    );
    expect(log.find((e) => e.action === 'rider.vehicle-approve').summary).toMatch(/to Car · ABC 1234/);

    // Nothing left to decide.
    expect(
      (await admin.patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`).send({ action: 'approve' }))
        .status,
    ).toBe(409);
  });

  it('lets the rider withdraw a request, and an admin turn one down with a reason', async () => {
    const before = (await freeRider()).riderProfile;
    const ramon = await signIn('ramon');
    const admin = await signIn('admin');

    await ramon.patch('/api/rider/profile').send({ vehicle: 'van' });
    const withdrawn = await ramon.patch('/api/rider/profile').send({ cancelVehicleRequest: true });
    expect(withdrawn.body.profile.vehicleRequest).toBeUndefined();

    await ramon.patch('/api/rider/profile').send({ vehicle: 'van' });
    const no = await admin
      .patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`)
      .send({ action: 'reject', note: 'Send a photo of the van first.' });
    expect(no.status).toBe(200);
    const p = (await User.findById(users.ramon._id).lean()).riderProfile;
    expect(p.vehicle).toBe(before.vehicle);
    expect(p.vehicleRequest).toBeUndefined();
    expect(
      await Notification.exists({ user: users.ramon._id, body: 'Send a photo of the van first.' }),
    ).toBeTruthy();

    // Riders and customers can't decide; bad actions are refused.
    expect(
      (await ramon.patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`).send({ action: 'approve' }))
        .status,
    ).toBe(403);
    expect(
      (await admin.patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`).send({ action: 'maybe' }))
        .status,
    ).toBe(400);
  });

  it('refuses changes while the rider has an order out, and approving waits for it too', async () => {
    const joy = await signIn('joy'); // seeded with deliveries on the way
    expect(await Order.exists({ rider: users.joy._id, status: { $in: ON_THE_WAY } })).toBeTruthy();
    const res = await joy.patch('/api/rider/profile').send({ vehicle: 'van', plate: 'NEW 1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ON_DELIVERY');
    // The phone still changes: only admins see it.
    expect((await joy.patch('/api/rider/profile').send({ phone: '09170000000' })).status).toBe(200);

    // A request made while free, then an order arrives: approving has to wait.
    await freeRider();
    const ramon = await signIn('ramon');
    await ramon.patch('/api/rider/profile').send({ vehicle: 'van' });
    const order = await Order.findOne({ rider: users.joy._id, status: 'shipped' });
    await Order.updateOne({ _id: order._id }, { rider: users.ramon._id });
    const admin = await signIn('admin');
    const wait = await admin
      .patch(`/api/admin/riders/${users.ramon._id}/vehicle-request`)
      .send({ action: 'approve' });
    expect(wait.status).toBe(409);
    expect((await User.findById(users.ramon._id).lean()).riderProfile.vehicleRequest).toBeTruthy();
  });

  it('records on the order the vehicle the rider set out with', async () => {
    const order = await Order.findOne({
      rider: users.joy._id,
      status: 'shipped',
      retryOn: { $exists: false },
    });
    const joy = await signIn('joy');
    expect((await riderStep(joy, order._id, 'out-for-delivery')).status).toBe(200);
    const stored = await Order.findById(order._id).lean();
    const profile = (await User.findById(users.joy._id).lean()).riderProfile;
    expect(stored.riderVehicle).toEqual({ vehicle: profile.vehicle, plate: profile.plate });

    // The buyer sees that copy, even if the profile were to change afterwards.
    await User.updateOne({ _id: users.joy._id }, { 'riderProfile.plate': 'ZZZ 999' });
    const buyer = await signIn(Object.keys(users).find((k) => String(users[k]._id) === String(order.user)));
    const seen = (await buyer.get(`/api/orders/${order._id}`)).body;
    const rider = seen.rider ?? seen.order?.rider;
    expect(rider.riderProfile.plate).toBe(profile.plate);
  });
});
