import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Notification, Order, User } from '../src/models/index.js';
import { address, app, productId, signIn, useSeededDb, riderStep } from './helpers.js';
import { users } from '../src/seed/data.js';
import { pickRider } from '../src/features/riders/service.js';

useSeededDb();

const id = (key) => users[key]._id;

// A fresh Glide order from Mika, taken up to `status` by the shop.
async function orderUpTo(status) {
  const mika = await signIn('mika');
  const placed = await mika.post('/api/orders').send({ items: [{ productId: productId(12), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
  const order = placed.body.orders[0];
  const glide = await signIn('glide');
  for (const step of ['processing', 'shipped'].slice(0, status === 'shipped' ? 2 : 1)) {
    await glide.patch(`/api/orders/${order._id}/status`).send({ status: step });
  }
  return { order, mika, glide };
}

describe('deliveries', () => {
  it('stops the shop at shipped, and assigns the rider dispatch picks when it ships', async () => {
    const expected = await pickRider();

    const { order, glide } = await orderUpTo('shipped');
    const shipped = await Order.findById(order._id).lean();
    expect(shipped.status).toBe('shipped');
    expect(String(shipped.rider)).toBe(String(expected));
    expect(await Notification.exists({ user: expected, title: /New delivery/ })).toBeTruthy();

    for (const status of ['out-for-delivery', 'delivered']) {
      const res = await glide.patch(`/api/orders/${order._id}/status`).send({ status });
      expect(res.status).toBe(422);
    }
  });

  it('lets only the assigned rider take it out and mark it delivered, in order', async () => {
    const { order, mika } = await orderUpTo('shipped');
    const { rider } = await Order.findById(order._id).lean();
    const mine = Object.keys(users).find((k) => String(id(k)) === String(rider));
    const other = ['ramon', 'joy', 'dante'].find((k) => k !== mine);
    const me = await signIn(mine);
    const move = (agent, status) => riderStep(agent, order._id, status);

    expect((await move(await signIn(other), 'out-for-delivery')).status).toBe(404);
    expect((await move(mika, 'delivered')).status).toBe(403);
    expect((await move(me, 'shipped')).status).toBe(422);

    const list = await me.get('/api/deliveries');
    expect(list.body.items.map((o) => o._id)).toContain(order._id);
    expect(list.body.items.find((o) => o._id === order._id).shippingAddress.phone).toBe(address.phone);

    expect((await move(me, 'out-for-delivery')).body.order.status).toBe('out-for-delivery');
    const done = await move(me, 'delivered');
    expect(done.body.order).toMatchObject({ status: 'delivered', deliveredBy: 'rider' });
    expect((await move(me, 'delivered')).status).toBe(422);
    expect((await me.get('/api/deliveries?view=done')).body.items.map((o) => o._id)).toContain(order._id);

    // Both sides see it, and the rider can open the order. The customer can say it arrived, but that only records
    // their answer: it doesn't change the status or who delivered it, and the rider can't answer for them.
    expect((await mika.get(`/api/orders/${order._id}`)).body.order.rider.name).toBe(users[mine].name.split(' ')[0]); // buyers get a first name
    expect((await me.get(`/api/orders/${order._id}`)).status).toBe(200);
    expect((await me.patch(`/api/orders/${order._id}/received`)).status).toBe(404);
    const answered = await mika.patch(`/api/orders/${order._id}/received`);
    expect(answered.status).toBe(200);
    expect(answered.body.order).toMatchObject({ status: 'delivered', deliveredBy: 'rider' });
    expect(answered.body.order.receivedAt).toBeTruthy();
  });

  it("won't ship without an active rider", async () => {
    await User.updateMany({ role: 'rider' }, { isActive: false });
    const { order, glide } = await orderUpTo('processing');
    const res = await glide.patch(`/api/orders/${order._id}/status`).send({ status: 'shipped' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_RIDER');
    expect((await Order.findById(order._id).lean()).status).toBe('processing');
    await User.updateMany({ role: 'rider' }, { isActive: true });
  });

  it("keeps riders out of shopping and other people's orders", async () => {
    const joy = await signIn('joy');
    expect((await joy.get('/api/cart')).status).toBe(403);
    const placed = await joy.post('/api/orders').send({ items: [{ productId: productId(12), qty: 1 }], shippingAddress: address, paymentMethod: 'cod' });
    expect(placed.status).toBe(403);
    const someone = await Order.findOne({ rider: { $ne: id('joy') } });
    expect((await joy.get(`/api/orders/${someone._id}`)).status).toBe(404);
    expect((await request(app).get('/api/deliveries')).status).toBe(401);
  });

  it('lets an admin who manages users make a customer a rider and back, with undo', async () => {
    const admin = await signIn('admin');
    const made = await admin.patch(`/api/admin/users/${id('lea')}`).send({ role: 'rider' });
    // Lea has orders on the way as a customer, so she has to wait.
    expect(made.status).toBe(400);

    const hopeful = await User.create({ name: 'Rider Hopeful', email: 'hopeful@loadout.test', password: 'password123' });
    const ok = await admin.patch(`/api/admin/users/${hopeful._id}`).send({ role: 'rider' });
    expect(ok.body.user.role).toBe('rider');
    const back = await admin.patch(`/api/admin/users/${hopeful._id}`).send({ role: 'customer' });
    expect(back.body.user.role).toBe('customer');

    const owner = await signIn('owner');
    const log = await owner.get('/api/admin/activity');
    const entry = log.body.items.find((e) => e.action === 'user.unrider');
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(200);
    expect((await User.findById(hopeful._id)).role).toBe('rider');

    // A rider with deliveries on the way can't be switched back.
    const busy = await Order.findOne({ status: 'shipped' }).lean();
    expect((await admin.patch(`/api/admin/users/${busy.rider}`).send({ role: 'customer' })).status).toBe(400);
  });
});
