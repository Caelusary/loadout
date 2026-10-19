import path from 'node:path';
import { Order, PendingPhoto, User } from '../../models/index.js';
import { ON_THE_WAY, RIDER_STEPS, TRANSITIONS } from '../../models/Order.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { IMAGE_EXTS, imageTypeOf, MB } from '../../lib/images.js';
import { claimUploads, trackUpload } from '../../lib/pendingPhotos.js';
import { pageParams, paginate } from '../../lib/request.js';
import { saveFile } from '../../lib/storage.js';
import { stripMetadata } from '../../lib/stripMetadata.js';
import { notify, orderNotices } from '../notifications/service.js';
import { riderCopy } from '../orders/service.js';

const SELLER_FIELDS = 'sellerProfile.shopName sellerProfile.slug';

// A rider's orders: the ones still to deliver (oldest hand-over first, the way a route is run),
// or the ones already done (newest first).
export async function myDeliveries(req, res) {
  const done = req.query.view === 'done';
  const filter = { rider: req.user._id, status: done ? { $in: ['delivered', 'cancelled'] } : { $in: ON_THE_WAY } };
  const sort = done ? { updatedAt: -1, _id: -1 } : { createdAt: 1, _id: 1 };
  const [page, active, finished] = await Promise.all([
    paginate(Order, filter, pageParams(req.query), (q) =>
      q.sort(sort).populate('user', 'name').populate('seller', SELLER_FIELDS),
    ),
    Order.countDocuments({ rider: req.user._id, status: { $in: ON_THE_WAY } }),
    Order.countDocuments({ rider: req.user._id, status: { $in: ['delivered', 'cancelled'] } }),
  ]);
  res.json({ ...page, items: page.items.map((o) => riderCopy(o.toJSON())), counts: { active, done: finished } });
}

// The photo of the parcel at the door, uploaded just before "Mark delivered". The picture's own metadata is removed;
// where the rider was comes from the phone's location instead, sent with the delivery and kept for admins.
export async function uploadProof(req, res) {
  if (!req.file) throw invalid({ file: 'Take a photo of the parcel.' });
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
  if (!IMAGE_EXTS.includes(ext)) throw invalid({ file: 'Upload a JPG, PNG or WebP photo.' });
  if (req.file.size > 2 * MB) throw new AppError(413, 'FILE_TOO_LARGE', 'Photos must be 2 MB or smaller.');
  const type = imageTypeOf(req.file.buffer);
  if (!type) throw invalid({ file: 'That is not a valid JPG, PNG or WebP photo.' });
  const stored = await saveFile(stripMetadata(req.file.buffer, type), { ext: type, kind: 'proof' });
  await trackUpload(stored.url, req.user._id, 'proof');
  res.status(201).json({ url: stored.url });
}

// The phone's location, if the rider allowed it. Anything malformed is dropped rather than refused: the photo is the
// proof, the location only backs it up.
function locationFrom(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const accuracy = Number(value?.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng, ...(Number.isFinite(accuracy) && accuracy >= 0 && { accuracy: Math.round(accuracy) }) };
}

// The rider takes an order out for delivery, then marks it delivered with a photo (which starts the return window).
export async function advanceDelivery(req, res) {
  const next = req.body?.status;
  if (!RIDER_STEPS.includes(next)) {
    throw new AppError(422, 'INVALID_TRANSITION', 'Riders mark orders out for delivery or delivered.');
  }
  let deliveryProof;
  if (next === 'delivered') {
    const url = req.body?.proof?.url;
    // Only a photo this rider just uploaded through the proof uploader, so one picture can't prove two deliveries.
    const own = typeof url === 'string' && (await PendingPhoto.exists({ url, user: req.user._id, kind: 'proof' }));
    if (!own) throw invalid({ proof: 'Take a photo of the parcel at the door first.' });
    deliveryProof = { url, at: new Date(), location: locationFrom(req.body.proof.location) };
  }
  // A buyer who's away picked the day for the next try.
  if (next === 'out-for-delivery') {
    const waiting = await Order.findOne({ _id: req.params.id, rider: req.user._id, retryOn: { $gt: new Date() } }, 'retryOn');
    if (waiting) {
      const day = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(waiting.retryOn);
      throw new AppError(409, 'RETRY_LATER', `The buyer asked for the next try on ${day}.`);
    }
  }
  // Setting out: the order keeps the vehicle and plate the rider is using (see Order.riderVehicle).
  const me = next === 'out-for-delivery' ? await User.findById(req.user._id, 'riderProfile') : null;
  const allowedFrom = Object.keys(TRANSITIONS).filter((from) => TRANSITIONS[from].includes(next));
  // The status condition makes this safe against a concurrent cancel or the 7-day auto-complete.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, rider: req.user._id, status: { $in: allowedFrom } },
    {
      status: next,
      ...(next === 'out-for-delivery' && { $unset: { retryOn: 1 } }),
      ...(me && { riderVehicle: { vehicle: me.riderProfile?.vehicle, plate: me.riderProfile?.plate } }),
      ...(deliveryProof && { deliveredBy: 'rider', deliveryProof }),
      $push: { statusHistory: { status: next, at: new Date() } },
    },
    { new: true },
  );
  if (!order) {
    if (!(await Order.exists({ _id: req.params.id, rider: req.user._id }))) throw notFound('That delivery');
    throw new AppError(422, 'INVALID_TRANSITION', `This order can't move to ${next} from its current status.`);
  }
  if (deliveryProof) await claimUploads([deliveryProof.url]);
  await notify([orderNotices.toCustomer(order), ...(next === 'delivered' ? [orderNotices.deliveredForSeller(order)] : [])]);
  res.json({ order: riderCopy(order.toJSON()) });
}
