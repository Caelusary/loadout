import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Order, Product, User } from '../../models/index.js';
import { ON_THE_WAY, ORDER_STATUSES, SELLER_STEPS, TRANSITIONS } from '../../models/Order.js';
import { AppError, notFound } from '../../lib/AppError.js';
import { isId, pageParams, paginate, sameId } from '../../lib/request.js';
import { canManage } from '../../middleware/auth.js';
import { assertCanShop, cartLineError, normalizeItems, ownProductError } from './cart.js';
import { shippingFor } from './shipping.js';
import { allocate, priceCoupon, redeemCoupon, releaseCouponIfCheckoutVoid } from '../coupons/service.js';
import { notify, orderNotices } from '../notifications/service.js';
import { orderLabel, record } from '../activity/service.js';
import { pickRider, releaseCouponsAfterCommit } from './service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELLER_FIELDS = 'name sellerProfile.shopName sellerProfile.slug';
const RIDER_FIELDS = 'name';

async function reserve({ productId, qty }, session) {
  const product = await Product.findOneAndUpdate(
    { _id: productId, isActive: true, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true, session },
  );
  if (product) return product;
  throw cartLineError(await Product.findById(productId).session(session), productId);
}

// Prices, totals and grouping come only from the database; the client sends ids and quantities.
export async function createOrders(req, res) {
  assertCanShop(req.user);
  const body = req.body ?? {};
  const items = normalizeItems(body.items);
  // The client makes one id per checkout and resends it on a retry (a double tap, or a request whose
  // reply was lost), so a repeat gets the orders the first one placed instead of buying it all again.
  const checkoutId = typeof body.checkoutId === 'string' && UUID.test(body.checkoutId) ? body.checkoutId : randomUUID();
  const placedBefore = () => Order.find({ user: req.user._id, checkoutId }).sort({ _id: 1 });
  const earlier = await placedBefore();
  if (earlier.length) return res.json({ checkoutId, orders: earlier, addressSaved: false, repeated: true });

  const orders = await mongoose.connection.transaction(async (session) => {
    // Checkout from the cart page buys the items ticked there, each as it is in the saved cart. A second
    // tab still showing items the first tab already bought (they leave the saved cart on checkout) would
    // otherwise buy them again.
    if (body.fromCart === true) {
      const { cart } = await User.findById(req.user._id).select('cart').session(session);
      const saved = new Map(cart.map((line) => [String(line.product), line.qty]));
      if (items.some((item) => saved.get(item.productId) !== item.qty)) {
        throw new AppError(409, 'CART_CHANGED', 'Your cart changed, maybe in another tab. Check it and place the order again.');
      }
    }
    const bySeller = new Map();
    for (const item of items) {
      const product = await reserve(item, session);
      if (product.seller.equals(req.user._id)) throw ownProductError(item.productId);
      const key = product.seller.toString();
      if (!bySeller.has(key)) bySeller.set(key, []);
      bySeller.get(key).push({
        product: product._id,
        name: product.name,
        priceCents: product.priceCents,
        qty: item.qty,
        image: product.images[0]?.url,
      });
    }
    const groups = [...bySeller];
    const subtotals = groups.map(([, orderItems]) =>
      orderItems.reduce((sum, i) => sum + i.priceCents * i.qty, 0),
    );

    // A discount code covers the whole checkout; each shop's order carries its proportional share.
    let shares = subtotals.map(() => 0);
    let couponCode;
    if (body.couponCode) {
      const checkoutSubtotal = subtotals.reduce((a, b) => a + b, 0);
      const { coupon, discountCents } = await priceCoupon(
        body.couponCode,
        req.user,
        checkoutSubtotal,
        session,
      );
      await redeemCoupon(coupon, req.user, session);
      shares = allocate(discountCents, subtotals);
      couponCode = coupon.code;
    }

    const docs = groups.map(([seller, orderItems], i) => ({
      user: req.user._id,
      seller,
      checkoutId,
      items: orderItems,
      shippingAddress: body.shippingAddress,
      shippingCents: shippingFor(subtotals[i]),
      discountCents: shares[i],
      ...(couponCode && { couponCode }),
      paymentMethod: body.paymentMethod,
    }));
    const created = await Order.create(docs, { session, ordered: true }).catch((err) => {
      // The same checkout committed while this one was running.
      if (err.code === 11000) throw new AppError(409, 'DUPLICATE_CHECKOUT', 'This order was already placed.');
      throw err;
    });
    // What was bought leaves the saved cart in the same transaction, so a failed checkout keeps it intact.
    // "Buy now" checks out one item on the side and leaves the cart exactly as it was.
    if (body.buyNow !== true) {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { cart: { product: { $in: items.map((i) => i.productId) } } } },
        { session },
      );
    }
    return created;
  }).catch(async (err) => {
    if (err.code !== 'DUPLICATE_CHECKOUT' && err.code !== 11000) throw err;
    const placed = await placedBefore();
    if (!placed.length) throw err;
    return null;
  });
  if (!orders) return res.json({ checkoutId, orders: await placedBefore(), addressSaved: false, repeated: true });

  await notify(orders.map((order) => orderNotices.placed(order, req.user.name)));

  // The orders are already committed, so a failed address save must not turn this into an error:
  // the shopper would retry and buy everything twice.
  let addressSaved = false;
  if (body.saveAddress) {
    req.user.shippingAddress = body.shippingAddress;
    addressSaved = await req.user.save().then(
      () => true,
      (err) => {
        console.warn(`Could not save the checkout address: ${err.message}`);
        return false;
      },
    );
  }
  res.status(201).json({ checkoutId, orders, addressSaved });
}

export async function myOrders(req, res) {
  const filter = { user: req.user._id };
  if (typeof req.query.checkoutId === 'string') filter.checkoutId = req.query.checkoutId;
  // One checkout's orders (the confirmation page) come back whole; the order history is paged.
  if (filter.checkoutId) {
    return res.json({ items: await Order.find(filter).sort({ createdAt: -1, _id: -1 }).populate('seller', SELLER_FIELDS) });
  }
  res.json(
    await paginate(Order, filter, pageParams(req.query), (q) => q.sort({ createdAt: -1, _id: -1 }).populate('seller', SELLER_FIELDS)),
  );
}

export async function soldOrders(req, res) {
  const filter = { seller: req.user._id };
  if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  res.json(
    await paginate(Order, filter, pageParams(req.query), (q) =>
      q.sort({ createdAt: -1, _id: -1 }).populate('user', 'name email'),
    ),
  );
}

export async function allOrders(req, res) {
  const filter = {};
  if (ORDER_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (isId(req.query.seller)) filter.seller = req.query.seller;
  res.json(
    await paginate(Order, filter, pageParams(req.query), (q) =>
      q.sort({ createdAt: -1, _id: -1 }).populate('user', 'name email').populate('seller', SELLER_FIELDS),
    ),
  );
}

export async function getOrder(req, res) {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('seller', SELLER_FIELDS)
    .populate('rider', RIDER_FIELDS);
  const allowed =
    order &&
    (canManage(req.user, 'orders') || sameId(order.user, req.user) || sameId(order.seller, req.user) || sameId(order.rider, req.user));
  if (!allowed) throw notFound('That order');
  res.json({ order });
}

export async function cancelOrder(req, res) {
  const order = await Order.findById(req.params.id);
  const isAdmin = canManage(req.user, 'orders');
  const isCustomer = order && sameId(order.user, req.user);
  if (!order || (!isAdmin && !isCustomer)) throw notFound('That order');

  // Admins may cancel anything not yet delivered, which the forward-only TRANSITIONS map doesn't allow.
  const allowedFrom = isCustomer ? ['placed'] : ['placed', 'processing', ...ON_THE_WAY];
  const updated = await mongoose.connection.transaction(async (session) => {
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: allowedFrom } },
      {
        status: 'cancelled',
        cancelledBy: isCustomer ? 'customer' : 'admin',
        $push: { statusHistory: { status: 'cancelled', at: new Date() } },
      },
      { new: true, session },
    );
    if (!cancelled) {
      throw new AppError(
        422,
        'INVALID_TRANSITION',
        isCustomer
          ? 'Orders can only be cancelled before the seller starts processing them.'
          : 'Delivered or cancelled orders cannot be cancelled.',
      );
    }
    for (const item of cancelled.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty } }, { session });
    }
    await releaseCouponIfCheckoutVoid(cancelled, session);
    // An admin's cancel is logged but can't be undone: the stock has gone back and may have sold again.
    if (!isCustomer) {
      await record(
        req.user,
        {
          action: 'order.cancel',
          target: { kind: 'order', id: cancelled._id, label: orderLabel(cancelled) },
          summary: `cancelled ${orderLabel(cancelled)}`,
          undoable: false,
        },
        session,
      );
    }
    return cancelled;
  });
  await releaseCouponsAfterCommit([updated]);
  // The customer hears about an admin cancel; the shop hears about every cancel.
  await notify([
    orderNotices.cancelledForSeller(updated, updated.cancelledBy),
    ...(updated.cancelledBy === 'admin' ? [orderNotices.toCustomer(updated)] : []),
    ...(updated.rider ? [{ ...orderNotices.toCustomer(updated), user: updated.rider, link: '/deliveries' }] : []),
  ]);
  res.json({ order: updated });
}

// The seller prepares the order and hands it over: marking it shipped assigns a rider, who takes it
// from there (see deliveries). Only the rider marks an order delivered.
export async function advanceOrder(req, res) {
  const next = req.body?.status;
  if (!SELLER_STEPS.includes(next)) {
    throw new AppError(
      422,
      'INVALID_TRANSITION',
      'Shops move orders to processing or shipped. The rider marks them out for delivery and delivered.',
    );
  }
  const allowedFrom = Object.keys(TRANSITIONS).filter((from) => TRANSITIONS[from].includes(next));
  const rider = next === 'shipped' ? await pickRider() : undefined;
  if (rider === null) {
    throw new AppError(409, 'NO_RIDER', 'No delivery riders are available right now. Try again later or contact the store admin.');
  }
  // The status condition makes this safe against a concurrent cancel.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, seller: req.user._id, status: { $in: allowedFrom } },
    {
      status: next,
      ...(rider && { rider }),
      $push: { statusHistory: { status: next, at: new Date() } },
    },
    { new: true },
  );
  if (!order) {
    if (!(await Order.exists({ _id: req.params.id, seller: req.user._id }))) throw notFound('That order');
    throw new AppError(
      422,
      'INVALID_TRANSITION',
      `This order can't move to ${next} from its current status.`,
    );
  }
  await notify([orderNotices.toCustomer(order), ...(rider ? [orderNotices.assigned(order)] : [])]);
  res.json({ order });
}
