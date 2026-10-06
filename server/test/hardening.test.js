import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ActivityLog, Coupon, Notification, Order, Product, Review, User } from '../src/models/index.js';
import { purgeExpired } from '../src/features/activity/service.js';
import { outbox } from '../src/lib/mail.js';
import { autoCompleteShipped } from '../src/features/orders/service.js';
import { users } from '../src/seed/data.js';
import { address, app, productId, signIn, useSeededDb } from './helpers.js';

useSeededDb();

const id = (key) => users[key]._id.toString();
const DAY_MS = 24 * 60 * 60 * 1000;
const cookieOf = (res) => res.headers['set-cookie'].find((c) => c.startsWith('loadout_token=')).split(';')[0];
const login = (email, password = 'password123') => request(app).post('/api/auth/login').send({ email, password });
const stock = async (n) => (await Product.findById(productId(n))).stock;

describe('sessions', () => {
  it('ends a copied cookie on sign-out, and other devices on a password change', async () => {
    const laptop = cookieOf(await login(users.paolo.email));
    const phone = cookieOf(await login(users.paolo.email));
    const me = (cookie) => request(app).get('/api/auth/me').set('Cookie', cookie);
    expect((await me(laptop)).status).toBe(200);

    // A copy of the phone's cookie made before signing out no longer works afterwards.
    await request(app).post('/api/auth/logout').set('Cookie', phone);
    expect((await me(phone)).status).toBe(401);
    expect((await me(laptop)).status).toBe(200);

    const tablet = cookieOf(await login(users.paolo.email));
    const changed = await request(app)
      .patch('/api/users/me/password')
      .set('Cookie', tablet)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(changed.status).toBe(200);
    expect((await me(tablet)).status).toBe(200);
    expect((await me(laptop)).status).toBe(401);
    await User.updateOne({ _id: id('paolo') }, { $set: { sessions: [] } });
    const restore = await signInWith(users.paolo.email, 'newpassword456');
    await restore.patch('/api/users/me/password').send({ currentPassword: 'newpassword456', newPassword: 'password123' });
  });

  it('asks for the current password to change the email', async () => {
    const mika = await signIn('mika');
    const bare = await mika.patch('/api/users/me').send({ email: 'mika2@loadout.test' });
    expect(bare.status).toBe(400);
    expect(bare.body.error.fields.currentPassword).toBeTruthy();
    expect((await mika.patch('/api/users/me').send({ name: 'Mika R.' })).status).toBe(200); // other fields don't
    const ok = await mika.patch('/api/users/me').send({ email: 'mika2@loadout.test', currentPassword: 'password123' });
    expect(ok.body.user.email).toBe('mika2@loadout.test');
    await mika.patch('/api/users/me').send({ email: users.mika.email, currentPassword: 'password123' });
  });
});

async function signInWith(email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
  return agent;
}

describe('password reset by email', () => {
  // The form answers before the email goes out, so this waits for the new message to land.
  const requestLink = async (email) => {
    const sent = outbox.length;
    expect((await request(app).post('/api/auth/forgot-password').send({ email })).status).toBe(200);
    return vi.waitFor(() => {
      const mail = outbox.slice(sent).find((m) => m.to === email);
      if (!mail) throw new Error('no email yet');
      return mail.text.match(/reset-password#([\w-]+)/)[1];
    });
  };

  it('emails a one-time link that sets a new password and signs everyone else out', async () => {
    const lea = await signIn('lea');
    const token = await requestLink(users.lea.email);
    // Unknown emails get the same answer, so nobody can check who has an account.
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@loadout.test' });
    expect(unknown.status).toBe(200);
    expect(outbox.some((m) => m.to === 'nobody@loadout.test')).toBe(false);
    // A second request inside two minutes sends nothing, so the form can't flood an inbox.
    const sent = outbox.length;
    await request(app).post('/api/auth/forgot-password').send({ email: users.lea.email });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(outbox.length).toBe(sent);

    const reset = (password, t = token) => request(app).post('/api/auth/reset-password').send({ token: t, password });
    expect((await reset('short')).status).toBe(400);
    const done = await reset('brandnewpass1');
    expect(done.status).toBe(200);
    expect(done.headers['set-cookie'].some((c) => c.startsWith('loadout_token='))).toBe(true);
    expect((await lea.get('/api/auth/me')).status).toBe(401); // the old session is gone
    expect((await reset('anotherpass2')).body.error.code).toBe('RESET_EXPIRED'); // one use only
    expect((await login(users.lea.email, 'brandnewpass1')).status).toBe(200);
    expect(await Notification.exists({ user: id('lea'), title: 'Your password was changed' })).toBeTruthy();

    const stale = await requestLink(users.lea.email);
    await User.updateOne({ _id: id('lea') }, { 'passwordReset.expiresAt': new Date(Date.now() - 1000) });
    expect((await reset('password123', stale)).body.error.code).toBe('RESET_EXPIRED');
    await User.updateOne({ _id: id('lea') }, { $unset: { passwordReset: 1 } });
    const restore = await signInWith(users.lea.email, 'brandnewpass1');
    await restore.patch('/api/users/me/password').send({ currentPassword: 'brandnewpass1', newPassword: 'password123' });
  });

  it("lets an admin send the reset email, which goes to the user's inbox, not the admin", async () => {
    const admin = await signIn('admin');
    const before = outbox.length;
    const res = await admin.post(`/api/admin/users/${id('paolo')}/reset-email`);
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(outbox.slice(before).map((m) => m.to)).toEqual([users.paolo.email]);
    // A second one inside two minutes is refused rather than flooding the inbox.
    expect((await admin.post(`/api/admin/users/${id('paolo')}/reset-email`)).status).toBe(429);
    expect((await ActivityLog.findOne({ action: 'user.reset-email' })).undoable).toBe(false);
    expect((await admin.post(`/api/admin/users/${id('owner')}/reset-email`)).status).toBe(403);
  });

  it('lets only one of two simultaneous requests use the same link', async () => {
    const token = await requestLink(users.mika.email);
    const results = await Promise.all(
      ['racerpass-one', 'racerpass-two'].map((password) =>
        request(app).post('/api/auth/reset-password').send({ token, password }).then((res) => ({ password, res })),
      ),
    );

    const statuses = results.map(({ res }) => res.status).sort();
    expect(statuses).toEqual([200, 400]);
    const winner = results.find(({ res }) => res.status === 200).password;
    const restore = await signInWith(users.mika.email, winner);
    await restore.patch('/api/users/me/password').send({ currentPassword: winner, newPassword: 'password123' });
  });

  it('counts the 72-character limit in bytes, which is all bcrypt reads', async () => {
    const token = await requestLink(users.mika.email);
    // 40 characters, but 80 bytes: past the 72nd byte bcrypt would silently ignore the rest.
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'é'.repeat(40) });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.password).toBeTruthy();
    await User.updateOne({ _id: id('mika') }, { $unset: { passwordReset: 1 } });
  });
});

describe('closing accounts', () => {
  it('lets people delete their own account, asking before it cancels unshipped orders', async () => {
    const mika = await signIn('mika');
    expect((await mika.delete('/api/users/me').send({ password: 'wrong' })).status).toBe(400);
    // Mika has a shipped order on the way: wait for it.
    const shipped = await mika.delete('/api/users/me').send({ password: 'password123', cancelOrders: true });
    expect(shipped.body.error.code).toBe('ORDERS_SHIPPED');
    await Order.updateMany({ user: id('mika'), status: 'shipped' }, { status: 'delivered' });

    const ask = await mika.delete('/api/users/me').send({ password: 'password123' });
    expect(ask.status).toBe(409);
    expect(ask.body.error.code).toBe('OPEN_ORDERS');

    const before = await stock(8);
    const done = await mika.delete('/api/users/me').send({ password: 'password123', cancelOrders: true });
    expect(done.status).toBe(200);
    expect(done.body.cancelled).toBeGreaterThan(0);
    expect(await stock(8)).toBe(before + 1);
    expect(await User.exists({ _id: id('mika') })).toBeNull();
    expect(await Review.countDocuments({ user: id('mika') })).toBe(0);
    expect((await mika.get('/api/auth/me')).status).toBe(401);

    const admin = await signIn('admin');
    expect((await admin.delete('/api/users/me').send({ password: 'password123' })).status).toBe(403);
  });

  it('asks an admin whether to cancel unshipped orders when deactivating', async () => {
    const admin = await signIn('admin');
    const open = await Order.countDocuments({ user: id('lea'), status: { $in: ['placed', 'processing'] } });
    expect(open).toBeGreaterThan(0);
    const res = await admin.patch(`/api/admin/users/${id('lea')}`).send({ isActive: false, cancelOrders: true });
    expect(res.body.cancelled).toBe(open);
    expect(await Order.countDocuments({ user: id('lea'), status: { $in: ['placed', 'processing'] } })).toBe(0);
    expect((await admin.patch(`/api/admin/users/${id('paolo')}`).send({ role: 'admin', cancelOrders: true })).status).toBe(400);
    await admin.patch(`/api/admin/users/${id('lea')}`).send({ isActive: true });
  });
});

describe('sellers', () => {
  it('lets a declined applicant apply again after a week', async () => {
    const admin = await signIn('admin');
    await admin.patch(`/api/admin/sellers/${id('coilworks')}`).send({ status: 'suspended' });
    const carlo = await signIn('coilworks');
    const early = await carlo.post('/api/users/me/seller-application').send({ shopName: 'Coilworks Again' });
    expect(early.status).toBe(409);
    expect(early.body.error.message).toMatch(/apply again on/);

    await User.updateOne({ _id: id('coilworks') }, { 'sellerProfile.reviewedAt': new Date(Date.now() - 8 * DAY_MS) });
    const again = await carlo.post('/api/users/me/seller-application').send({ shopName: 'Coilworks Again' });
    expect(again.status).toBe(201);
    expect(again.body.user.sellerProfile.status).toBe('pending');
  });

  it("cancels a suspended shop's unshipped orders, and tells those customers when it's back", async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    const unshipped = await Order.find({ seller: id('glide'), status: { $in: ['placed', 'processing'] } });
    expect(unshipped.length).toBeGreaterThan(0); // earlier tests here already cancelled some
    const item = unshipped[0].items[0];
    const before = (await Product.findById(item.product)).stock;

    await admin.patch(`/api/admin/sellers/${id('glide')}`).send({ status: 'suspended' });
    const after = await Order.find({ _id: { $in: unshipped.map((o) => o._id) } });
    expect(after.every((o) => o.status === 'cancelled' && o.cancelReason.includes('suspended'))).toBe(true);
    expect((await Product.findById(item.product)).stock).toBeGreaterThanOrEqual(before + item.qty);
    const customers = [...new Set(unshipped.map((o) => String(o.user)))];
    for (const customer of customers) {
      expect(await Notification.exists({ user: customer, title: /cancelled/ })).toBeTruthy();
    }

    const entry = await ActivityLog.findOne({ action: 'seller.suspend' }).sort({ createdAt: -1 });
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(200);
    for (const customer of customers) {
      expect(await Notification.exists({ user: customer, title: 'Glide Lab is back' })).toBeTruthy();
    }
    expect(await Notification.exists({ user: id('glide'), title: 'Glide Lab is reinstated' })).toBeTruthy();
  });
});

describe('receiving and returns', () => {
  it('lets the customer confirm receipt, and completes unconfirmed orders after 7 days', async () => {
    const paolo = await signIn('paolo');
    const order = await Order.findOne({ user: id('paolo'), status: 'shipped' });
    const res = await paolo.patch(`/api/orders/${order._id}/received`);
    expect(res.body.order).toMatchObject({ status: 'delivered', deliveredBy: 'customer' });
    expect((await paolo.patch(`/api/orders/${order._id}/received`)).status).toBe(422);

    const stale = await Order.create({
      ...(await Order.findById(order._id).lean()),
      _id: undefined,
      checkoutId: `stale-${order._id}`,
      status: 'shipped',
      statusHistory: [{ status: 'placed' }, { status: 'shipped', at: new Date(Date.now() - 8 * DAY_MS) }],
    });
    expect(await autoCompleteShipped()).toBeGreaterThanOrEqual(1);
    expect((await Order.findById(stale._id)).deliveredBy).toBe('auto');
  });

  it('runs a return from request to refund, with the rules for what counts', async () => {
    const lea = await signIn('lea');
    const glide = await signIn('glide');
    const order = await Order.findOne({ user: id('lea'), seller: id('glide'), status: 'delivered' });
    const line = order.items[0];
    const ask = (body) => lea.post(`/api/orders/${order._id}/returns`).send(body);
    const good = { reason: 'damaged', details: 'The left click stopped working.', items: [{ productId: String(line.product), qty: 1 }] };

    await Order.updateOne({ _id: order._id }, { statusHistory: [{ status: 'delivered', at: new Date(Date.now() - 9 * DAY_MS) }] });
    expect((await ask(good)).body.error.message).toMatch(/within 7 days/);
    await Order.updateOne({ _id: order._id }, { statusHistory: [{ status: 'delivered', at: new Date() }] });

    expect((await ask({ ...good, reason: 'changed-mind' })).status).toBe(400);
    expect((await ask({ ...good, items: [{ productId: String(line.product), qty: line.qty + 1 }] })).status).toBe(400);
    const created = await ask(good);
    expect(created.status).toBe(201);
    expect(created.body.return.refundCents).toBeLessThanOrEqual(line.priceCents);
    expect((await ask(good)).status).toBe(409); // one waiting at a time

    const rid = created.body.return._id;
    expect((await glide.patch(`/api/returns/${rid}/decision`).send({ decision: 'decline' })).status).toBe(400); // needs a reason
    await glide.patch(`/api/returns/${rid}/decision`).send({ decision: 'approve' });
    const before = await stock(Number(productIndex(line.product)));
    const received = await glide.patch(`/api/returns/${rid}/received`);
    expect(received.body.return.status).toBe('refunded');
    expect(await stock(Number(productIndex(line.product)))).toBe(before + 1);
    expect((await Order.findById(order._id)).refundedCents).toBe(created.body.return.refundCents);
    expect((await ask(good)).status).toBe(400); // that one is used up
  });

  it('sends a declined return to an admin, whose decision is final and logged', async () => {
    const paolo = await signIn('paolo');
    const glide = await signIn('glide');
    const admin = await signIn('admin');
    const order = await Order.findOne({ user: id('paolo'), seller: id('glide'), status: 'delivered' });
    await Order.updateOne({ _id: order._id }, { $push: { statusHistory: { status: 'delivered', at: new Date() } } });
    const created = await paolo
      .post(`/api/orders/${order._id}/returns`)
      .send({ reason: 'not-as-described', details: 'Listed as wireless, arrived wired.', items: [{ productId: String(order.items[0].product), qty: 1 }] });
    const rid = created.body.return._id;

    await glide.patch(`/api/returns/${rid}/decision`).send({ decision: 'decline', note: 'The listing says wired.' });
    expect((await paolo.patch(`/api/returns/${rid}/escalate`).send({ note: 'The box says wireless.' })).body.return.status).toBe('escalated');
    expect((await admin.get('/api/admin/returns')).body.items.map((r) => r._id)).toContain(rid);

    expect((await glide.patch(`/api/admin/returns/${rid}`).send({ decision: 'approve', note: 'Sure' })).status).toBe(403);
    const settled = await admin.patch(`/api/admin/returns/${rid}`).send({ decision: 'approve', note: 'The box photo matches.' });
    expect(settled.body.return.status).toBe('approved');
    expect((await ActivityLog.findOne({ action: 'return.decide' })).undoable).toBe(false);
    expect((await admin.patch(`/api/admin/returns/${rid}`).send({ decision: 'decline', note: 'Changed mind' })).status).toBe(422);
  });
});

const productIndex = (pid) => {
  for (let n = 1; n <= 22; n++) if (productId(n) === String(pid)) return n;
  throw new Error('unknown product');
};

describe('cart prices, search and codes', () => {
  it('remembers the price when added, so the cart can say it changed', async () => {
    const hush = await signIn('hush');
    const agent = await signIn('paolo');
    await agent.delete('/api/cart');
    await agent.post(`/api/cart/${productId(2)}`).send({ qty: 1 });
    const was = (await Product.findById(productId(2))).priceCents;
    await Product.updateOne({ _id: productId(2) }, { priceCents: was + 10000 });
    const [line] = (await agent.get('/api/cart')).body.items;
    expect(line.addedPriceCents).toBe(was);
    const ok = await agent.put(`/api/cart/${productId(2)}`).send({ qty: 1, acknowledgePrice: true });
    expect(ok.body.items[0].addedPriceCents).toBe(was + 10000);
    expect(hush).toBeTruthy();
  });

  it('ranks name matches first and ignores short words buried in descriptions', async () => {
    const res = await request(app).get('/api/products?q=frame');
    const names = res.body.items.map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => /frame/i.test(n))).toBe(true);
    const pro = await request(app).get('/api/products?q=pro');
    expect(pro.body.items.every((p) => /pro/i.test(`${p.name} ${p.brand} ${Object.values(p.specs ?? {}).join(' ')}`))).toBe(true);
  });

  it('matches words from their start, not from the middle of another word', async () => {
    const names = (await request(app).get('/api/products?q=pad&limit=50')).body.items.map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('Northpaw Numpad');
    expect((await request(app).get('/api/products?q=tri&limit=50')).body.total).toBeGreaterThan(0); // tri-mode
  });

  it('lists related products under a search, never repeating a result', async () => {
    const res = await request(app).get('/api/products?q=pad&limit=50');
    const results = res.body.items.map((p) => p._id);
    const related = res.body.related.map((p) => p.name);
    expect(related).toContain('Northpaw Numpad'); // "pad" mid-word
    expect(res.body.related.every((p) => !results.includes(p._id))).toBe(true);
    expect(res.body.related.length).toBeLessThanOrEqual(8);
    expect((await request(app).get('/api/products?q=pad&page=2&limit=2')).body.related).toBeUndefined();
  });

  it('matches connectivity words on the spec only, not on a description that mentions them', async () => {
    const res = await request(app).get('/api/products?q=wireless&limit=50');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.some((p) => p.specs?.connectivity === 'wired')).toBe(false);
  });

  it('suggests a corrected search only when nothing matched and the correction finds something', async () => {
    const typo = await request(app).get('/api/products?q=wirless%20keybord');
    expect(typo.body.total).toBe(0);
    expect(typo.body.suggestion).toBe('wireless keyboard');
    expect((await request(app).get(`/api/products?q=${encodeURIComponent(typo.body.suggestion)}`)).body.total).toBeGreaterThan(0);

    expect((await request(app).get('/api/products?q=wireless')).body.suggestion).toBeUndefined();
    expect((await request(app).get('/api/products?q=zzzzqqq')).body.suggestion).toBeUndefined();
  });

  it("gives a code's use back when two orders from one checkout are cancelled at once", async () => {
    const paolo = await signIn('paolo');
    await paolo.delete('/api/cart');
    const checkout = await paolo.post('/api/orders').send({
      items: [
        { productId: productId(3), qty: 1 },
        { productId: productId(17), qty: 1 },
      ],
      shippingAddress: address,
      paymentMethod: 'cod',
      couponCode: 'WELCOME200',
    });
    expect(checkout.status).toBe(201);
    const ids = checkout.body.orders.map((o) => o._id);
    expect(ids).toHaveLength(2);
    await Promise.all(ids.map((oid) => paolo.patch(`/api/orders/${oid}/cancel`)));
    const code = await Coupon.findOne({ code: 'WELCOME200' });
    expect(code.usedBy.map(String)).not.toContain(id('paolo'));
  });
});

describe('admin review removal and the restore window', () => {
  it('logs an admin removing a review, lets the owner put it back, and needs the Products area', async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    const review = await Review.findOne({ user: id('paolo') });
    const rating = (await Product.findById(review.product)).ratingCount;

    await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['users'] });
    expect((await admin.delete(`/api/reviews/${review._id}`)).status).toBe(404);
    await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['products'] });

    expect((await admin.delete(`/api/reviews/${review._id}`)).status).toBe(200);
    expect((await Product.findById(review.product)).ratingCount).toBe(rating - 1);
    const entry = await ActivityLog.findOne({ action: 'review.delete' });
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(200);
    expect((await Product.findById(review.product)).ratingCount).toBe(rating);
    await owner.patch(`/api/admin/users/${id('admin')}`).send({ permissions: ['users', 'sellers', 'products', 'orders', 'coupons'] });
  });

  it('erases a deleted account after 30 days, after which it cannot be restored', async () => {
    const admin = await signIn('admin');
    const owner = await signIn('owner');
    await Order.updateMany({ user: id('hush') }, { status: 'delivered' });
    await Order.updateMany({ seller: id('hush'), status: { $ne: 'cancelled' } }, { status: 'delivered' });
    expect((await admin.delete(`/api/admin/users/${id('hush')}`)).status).toBe(200);
    const entry = await ActivityLog.findOne({ action: 'user.delete' }).sort({ createdAt: -1 });

    expect(await purgeExpired(Date.now() + 31 * DAY_MS)).toBeGreaterThanOrEqual(1);
    const purged = await ActivityLog.findById(entry._id).select('+undo');
    expect(purged.undo).toBeUndefined();
    expect((await owner.post(`/api/admin/activity/${entry._id}/undo`)).status).toBe(422);
  });
});

describe('audit follow-ups', () => {
  it('ends sessions on deactivation, so reactivating does not revive old cookies', async () => {
    const cookie = cookieOf(await login(users.lea.email));
    const admin = await signIn('admin');
    await admin.patch(`/api/admin/users/${id('lea')}`).send({ isActive: false });
    await admin.patch(`/api/admin/users/${id('lea')}`).send({ isActive: true });
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('refuses to close an account with a return in progress, and keeps a closed return closed', async () => {
    const northpaw = await signIn('northpaw');
    const customer = await signIn('paolo');
    const order = await Order.findOne({ user: id('paolo'), seller: id('northpaw'), status: 'delivered' });
    await Order.updateOne({ _id: order._id }, { $push: { statusHistory: { status: 'delivered', at: new Date() } } });
    const line = order.items[0];
    const body = { reason: 'wrong-item', details: 'Got the wrong switch type.', items: [{ productId: String(line.product), qty: line.qty }] };
    const created = await customer.post(`/api/orders/${order._id}/returns`).send(body);
    expect(created.status).toBe(201);

    const blocked = await northpaw.delete('/api/users/me').send({ password: 'password123', cancelOrders: true });
    expect(blocked.body.error.code).toBe('RETURNS_OPEN');

    const rid = created.body.return._id;
    await northpaw.patch(`/api/returns/${rid}/decision`).send({ decision: 'decline', note: 'Matches the listing.' });
    await customer.patch(`/api/returns/${rid}/escalate`).send({ note: 'It does not match.' });
    const admin = await signIn('admin');
    await admin.patch(`/api/admin/returns/${rid}`).send({ decision: 'decline', note: 'The photos match the listing.' });
    expect((await customer.post(`/api/orders/${order._id}/returns`).send(body)).status).toBe(400);
  });
});
