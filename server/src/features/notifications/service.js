import { Notification } from '../../models/index.js';
import { orderNumber as shortId } from '../../lib/format.js';

export async function notify(entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).filter((e) => e?.user);
  if (!list.length) return;
  try {
    await Notification.insertMany(list, { ordered: false });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('Could not save notifications:', err.message);
  }
}


const STATUS_COPY = {
  processing: 'is being prepared',
  shipped: 'is waiting for rider pickup',
  'out-for-delivery': 'is out for delivery',
  delivered: 'was delivered',
  cancelled: 'was cancelled',
};

export const orderNotices = {
  placed: (order, customerName) => ({
    user: order.seller,
    type: 'order',
    title: `New order ${shortId(order._id)}`,
    body: `${customerName} ordered ${order.items.length} item${order.items.length === 1 ? '' : 's'}.`,
    link: `/orders/${order._id}`,
  }),
  toCustomer: (order) => ({
    user: order.user,
    type: 'order',
    title: `Order ${shortId(order._id)} ${STATUS_COPY[order.status]}`,
    // A delivered order asks the question instead of listing items: answering is what unlocks rating.
    body:
      order.status === 'delivered'
        ? 'Did it arrive? Let us know, then you can review your items.'
        : order.items.map((i) => i.name).join(', ').slice(0, 290),
    link: `/orders/${order._id}`,
  }),
  // The rider hears about a new delivery; the shop hears when its order is delivered.
  assigned: (order) => ({
    user: order.rider,
    type: 'order',
    title: `New delivery ${shortId(order._id)}`,
    body: `${order.shippingAddress.fullName}, ${order.shippingAddress.city}`,
    link: '/deliveries',
  }),
  deliveredForSeller: (order) => ({
    user: order.seller,
    type: 'order',
    title: `Order ${shortId(order._id)} was delivered`,
    body: 'The rider marked it delivered.',
    link: `/orders/${order._id}`,
  }),
  cancelledForSeller: (order, by) => ({
    user: order.seller,
    type: 'order',
    title: `Order ${shortId(order._id)} was cancelled`,
    body: by === 'admin' ? 'An admin cancelled it. The stock has been returned.' : 'The customer cancelled it. The stock has been returned.',
    link: `/orders/${order._id}`,
  }),
};
