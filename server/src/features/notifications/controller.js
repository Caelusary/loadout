import { Notification } from '../../models/index.js';
import { notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';

export async function listNotifications(req, res) {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ items, unread });
}

export async function readNotification(req, res) {
  const found = isId(req.params.id) && (await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { readAt: new Date() }, { new: true }));
  if (!found) throw notFound('That notification');
  res.json({ notification: found });
}

export async function readAll(req, res) {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ ok: true });
}
