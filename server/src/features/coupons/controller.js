import mongoose from 'mongoose';
import { Coupon } from '../../models/index.js';
import { COUPON_TYPES } from '../../models/Coupon.js';
import { invalid, notFound } from '../../lib/AppError.js';
import { pick } from '../../lib/request.js';
import { checkCart, normalizeItems } from '../orders/cart.js';
import { priceCoupon } from './service.js';
import { record } from '../activity/service.js';

// Checkout preview: runs checkout's own cart checks (without reserving stock), prices the cart from the
// database (never from the client), and applies the code, so a code that previews fine also checks out.
export async function previewCoupon(req, res) {
  const { code } = req.body ?? {};
  const items = normalizeItems(req.body?.items);
  const subtotalCents = await checkCart(items, req.user);
  const { coupon, discountCents } = await priceCoupon(code, req.user, subtotalCents);
  res.json({ code: coupon.code, type: coupon.type, value: coupon.value, discountCents, subtotalCents });
}

const FIELDS = ['code', 'type', 'value', 'minSubtotalCents', 'maxUses', 'expiresAt', 'isActive'];

export async function listCoupons(req, res) {
  const items = await Coupon.find({}, '-usedBy').sort({ createdAt: -1 });
  res.json({ items });
}

export async function createCoupon(req, res) {
  const data = pick(req.body, FIELDS);
  if (!COUPON_TYPES.includes(data.type)) throw invalid({ type: 'Choose percent or fixed.' });
  const coupon = await mongoose.connection.transaction(async (session) => {
    const [created] = await Coupon.create([data], { session });
    await record(
      req.user,
      { action: 'coupon.create', target: { kind: 'coupon', id: created._id, label: created.code }, summary: `created code ${created.code}` },
      session,
    );
    return created;
  });
  res.status(201).json({ coupon });
}

export async function updateCoupon(req, res) {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw notFound('That code');
  // The code itself and its type stay fixed once customers may have used it.
  const changes = pick(req.body, ['value', 'minSubtotalCents', 'maxUses', 'expiresAt', 'isActive']);
  const before = Object.fromEntries(Object.keys(changes).map((k) => [k, coupon[k] ?? null]));
  Object.assign(coupon, changes);
  const changed = Object.keys(changes).filter((k) => JSON.stringify(coupon[k] ?? null) !== JSON.stringify(before[k]));
  if (!changed.length) return res.json({ coupon });
  await mongoose.connection.transaction(async (session) => {
    await coupon.save({ session });
    const pickOf = (from) => Object.fromEntries(changed.map((k) => [k, from[k] ?? null]));
    const summary =
      changed.length === 1 && changed[0] === 'isActive'
        ? `turned ${coupon.isActive ? 'on' : 'off'} code ${coupon.code}`
        : `edited code ${coupon.code}`;
    await record(
      req.user,
      {
        action: 'coupon.update',
        target: { kind: 'coupon', id: coupon._id, label: coupon.code },
        summary,
        undo: { before: pickOf(before), after: pickOf(coupon) },
      },
      session,
    );
  });
  res.json({ coupon });
}
