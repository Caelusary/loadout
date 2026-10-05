import { Notification } from '../../models/index.js';

export async function notify(entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).filter((e) => e?.user);
  if (!list.length) return;
  try {
    await Notification.insertMany(list, { ordered: false });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('Could not save notifications:', err.message);
  }
}

const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

const STATUS_COPY = {
  processing: 'is being prepared',
  shipped: 'has shipped',
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
    body: order.items.map((i) => i.name).join(', ').slice(0, 290),
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
