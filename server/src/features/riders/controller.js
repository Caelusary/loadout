import { Order, RiderFeedback, User } from '../../models/index.js';
import { DECLINE_REASONS, ON_THE_WAY } from '../../models/Order.js';
import { RIDER_REPORT_REASONS } from '../../models/RiderFeedback.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { isId } from '../../lib/request.js';
import { orderLabel, record } from '../activity/service.js';
import { notify } from '../notifications/service.js';
import { windowOpen } from '../orders/receipt.js';
import {
  adminsFor,
  replyText,
  checkRatingAlert,
  DECLINE_ALERT,
  DECLINE_WINDOW_DAYS,
  declinesSince,
  holdRider,
  reassign,
  riderStats,
} from './service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// ---- The rider's own profile ----

export async function myProfile(req, res) {
  const rider = await User.findById(req.user._id, 'name email riderProfile');
  const reports = await RiderFeedback.find({ rider: rider._id, report: { $exists: true } })
    .sort({ 'report.at': -1 })
    .limit(20);
  res.json({
    profile: rider.riderProfile ?? {},
    held: Boolean(rider.riderProfile?.heldAt),
    stats: await riderStats(rider._id),
    reports: reports.map(riderReportView),
  });
}

// A report as the rider sees it: the reason and when, never the buyer's words or which order, so someone reporting
// harassment isn't handed back to the person they reported.
const riderReportView = (f) => ({
  _id: f._id,
  reason: f.report.reason,
  at: f.report.at,
  reply: f.riderReply ?? null,
  reviewed: Boolean(f.reviewedAt),
});

// The rider tells their side of a report about them, once, while no admin has decided yet.
export async function replyToReport(req, res) {
  if (!isId(req.params.id)) throw notFound('That report');
  const text = replyText(req.body);
  const mine = { _id: req.params.id, rider: req.user._id, report: { $exists: true } };
  const feedback = await RiderFeedback.findOneAndUpdate(
    { ...mine, reviewedAt: null, riderReply: { $exists: false } },
    { riderReply: { text, at: new Date() } },
    { new: true },
  );
  if (!feedback) {
    if (!(await RiderFeedback.exists(mine))) throw notFound('That report');
    throw new AppError(409, 'CONFLICT', 'You already replied, or an admin has already looked at it.');
  }
  const admins = await adminsFor('users');
  await notify(
    admins.map((user) => ({
      user,
      type: 'account',
      title: `${req.user.name} replied to a report`,
      body: "Their side is on the report, next to the buyer's.",
      link: `/admin/riders/${req.user._id}`,
    })),
  );
  res.json({ report: riderReportView(feedback) });
}

const VEHICLE_NAMES = { motorcycle: 'Motorcycle', bicycle: 'Bicycle', car: 'Car', van: 'Van' };
// "Motorcycle · DAQ 1937", for notices and the activity log.
const vehicleText = (v) => [VEHICLE_NAMES[v?.vehicle] ?? 'No vehicle', v?.plate].filter(Boolean).join(' · ');
const blank = (value) => (value === '' || value === null ? undefined : value);
const plateOf = (value) => (typeof value === 'string' ? blank(value.trim().toUpperCase()) : blank(value));
const onDelivery = (riderId) => Order.exists({ rider: riderId, status: { $in: ON_THE_WAY } });

// The phone changes straight away (only admins see it). The vehicle and plate are what buyers look for at the door, so
// after the first time they're set, a change becomes a request an admin approves, and can't be asked for at all while
// an order is with the rider. `cancelVehicleRequest` withdraws a waiting one. Every change is logged.
export async function updateMyProfile(req, res) {
  const body = req.body ?? {};
  const rider = await User.findById(req.user._id);
  rider.riderProfile ??= {};
  const p = rider.riderProfile;
  const log = [];

  if ('phone' in body && blank(body.phone) !== p.phone) {
    p.phone = blank(body.phone);
    log.push('changed their phone number');
  }
  if (body.cancelVehicleRequest && p.vehicleRequest) {
    log.push(`withdrew their vehicle change to ${vehicleText(p.vehicleRequest)}`);
    p.vehicleRequest = undefined;
  }

  const wants = {
    vehicle: 'vehicle' in body ? blank(body.vehicle) : p.vehicle,
    plate: 'plate' in body ? plateOf(body.plate) : p.plate,
  };
  const same = (a, b) => a?.vehicle === b?.vehicle && (a?.plate ?? undefined) === (b?.plate ?? undefined);
  let requested = false;
  if (!same(wants, p)) {
    // A typo is pointed out as one, whatever else stands in the way.
    const bad = new User({ riderProfile: wants }).validateSync([
      'riderProfile.vehicle',
      'riderProfile.plate',
    ]);
    if (bad)
      throw invalid(
        Object.fromEntries(Object.entries(bad.errors).map(([path, e]) => [path.split('.').pop(), e.message])),
      );
    if (!p.vehicle) {
      // Setting up for the first time: nothing to check against yet, and no buyer has been told anything.
      Object.assign(p, wants);
      log.push(`set their vehicle to ${vehicleText(wants)}`);
    } else if (!same(wants, p.vehicleRequest)) {
      if (await onDelivery(rider._id)) {
        throw new AppError(
          409,
          'ON_DELIVERY',
          'Finish your current deliveries first: those buyers have been told your current vehicle and plate.',
        );
      }
      p.vehicleRequest = { ...wants, at: new Date() };
      requested = true;
      log.push(`asked to change their vehicle from ${vehicleText(p)} to ${vehicleText(wants)}`);
    }
  }
  await rider.save();

  if (requested) {
    const admins = await adminsFor('users');
    await notify(
      admins.map((user) => ({
        user,
        type: 'account',
        title: `${rider.name} asked to change their vehicle`,
        body: `${vehicleText(p)} → ${vehicleText(p.vehicleRequest)}`,
        link: `/admin/riders/${rider._id}`,
      })),
    );
  }
  for (const summary of log) {
    await record(rider, {
      action: 'rider.profile',
      target: { kind: 'user', id: rider._id, label: rider.name },
      summary,
      undoable: false,
    });
  }
  res.json({
    profile: rider.riderProfile,
    held: Boolean(rider.riderProfile.heldAt),
    requested,
    stats: await riderStats(rider._id),
  });
}

// An admin approves or turns down a rider's vehicle change. Approving waits while the rider has an order out, so the
// buyers expecting them still see the vehicle they were told.
export async function decideVehicleRequest(req, res) {
  const rider = isId(req.params.id) ? await User.findOne({ _id: req.params.id, role: 'rider' }) : null;
  if (!rider) throw notFound('That rider');
  const action = req.body?.action;
  const note = text(req.body?.note, 200);
  if (!['approve', 'reject'].includes(action)) throw invalid({ action: 'Choose approve or reject.' });
  const ask = rider.riderProfile?.vehicleRequest;
  if (!ask) throw new AppError(409, 'CONFLICT', 'There is no vehicle change waiting for this rider.');
  const from = vehicleText(rider.riderProfile);
  const to = vehicleText(ask);
  if (action === 'approve') {
    if (await onDelivery(rider._id)) {
      throw new AppError(
        409,
        'ON_DELIVERY',
        `${rider.name} has an order out right now. Approve this once it's delivered, so those buyers see the vehicle they were told.`,
      );
    }
    rider.riderProfile.vehicle = ask.vehicle;
    rider.riderProfile.plate = ask.plate;
  }
  rider.riderProfile.vehicleRequest = undefined;
  await rider.save();
  await notify({
    user: rider._id,
    type: 'account',
    title: action === 'approve' ? 'Your vehicle change was approved' : "Your vehicle change wasn't approved",
    body:
      action === 'approve'
        ? `Buyers will now see ${to}.`
        : note || `An admin kept your current vehicle and plate (${from}).`,
    link: '/account/rider',
  });
  await record(req.user, {
    action: action === 'approve' ? 'rider.vehicle-approve' : 'rider.vehicle-reject',
    target: { kind: 'user', id: rider._id, label: rider.name },
    summary: `${action === 'approve' ? 'approved' : 'turned down'} ${rider.name}'s vehicle change from ${from} to ${to}${note ? `: ${note}` : ''}`,
    undoable: false,
  });
  res.json({ rider: await User.findById(rider._id, RIDER_LIST_FIELDS) });
}

// ---- Declining a delivery ----

// A rider can turn down an order they haven't picked up, with a reason. It goes straight to the next rider (never back
// to them), and admins hear when someone declines 3 in a week. There's no cap: a rider who can't take it shouldn't.
export async function declineDelivery(req, res) {
  const reason = req.body?.reason;
  if (!DECLINE_REASONS.includes(reason)) throw invalid({ reason: 'Pick a reason.' });
  const note = text(req.body?.note, 200);
  if (reason === 'other' && note.length < 3) throw invalid({ note: 'Tell us why in a few words.' });

  const order = await Order.findOneAndUpdate(
    // After a missed try the rider already has the parcel, so it's theirs to finish.
    { _id: req.params.id, rider: req.user._id, status: 'shipped', attempts: { $exists: false } },
    { $push: { declines: { rider: req.user._id, reason, ...(note && { note }), at: new Date() } } },
    { new: true },
  );
  if (!order) {
    if (!(await Order.exists({ _id: req.params.id, rider: req.user._id }))) throw notFound('That delivery');
    throw new AppError(409, 'ALREADY_PICKED_UP', 'You can only turn down an order before you pick it up.');
  }
  await reassign(order, req.user._id);

  const week = await declinesSince(req.user._id, new Date(Date.now() - DECLINE_WINDOW_DAYS * DAY_MS));
  if (week === DECLINE_ALERT) {
    const admins = await adminsFor('users');
    await notify(
      admins.map((user) => ({
        user,
        type: 'account',
        title: `${req.user.name} turned down ${DECLINE_ALERT} orders this week`,
        body: 'Open their record to see the reasons.',
        link: `/admin/riders/${req.user._id}`,
      })),
    );
  }
  res.json({ ok: true });
}

// ---- The buyer's side ----

async function ownOrderWithRider(req) {
  const order = isId(req.params.id) ? await Order.findOne({ _id: req.params.id, user: req.user._id }) : null;
  if (!order || !order.rider) throw notFound('That order');
  return order;
}

// Stars (and an optional comment) for the rider, once the buyer has said the order arrived.
export async function rateRider(req, res) {
  const order = await ownOrderWithRider(req);
  if (order.status !== 'delivered' || !order.receivedAt) {
    throw new AppError(409, 'NOT_RECEIVED', 'You can rate the rider once you confirm the order arrived.');
  }
  if (!windowOpen(order)) throw new AppError(409, 'TOO_LATE', 'Ratings close 7 days after delivery.');
  const stars = Number(req.body?.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw invalid({ stars: 'Pick 1 to 5 stars.' });
  const comment = text(req.body?.comment, 300);

  const feedback =
    (await RiderFeedback.findOne({ order: order._id, rider: order.rider })) ??
    new RiderFeedback({ order: order._id, rider: order.rider, user: req.user._id });
  if (feedback.stars)
    throw new AppError(409, 'ALREADY_RATED', 'You already rated this rider for this order.');
  Object.assign(feedback, { stars, comment: comment || undefined });
  await saveOnce(feedback);
  await checkRatingAlert(order.rider);
  res.status(201).json({ feedback: buyerView(feedback) });
}

// A report about the rider's behaviour. It pauses the rider from new deliveries straight away; an admin then clears
// them or deactivates the account. Waiting for an average to drop would be far too slow for a safety problem.
export async function reportRider(req, res) {
  const order = await ownOrderWithRider(req);
  const reportable = ON_THE_WAY.includes(order.status) || (order.status === 'delivered' && windowOpen(order));
  if (!reportable)
    throw new AppError(
      409,
      'TOO_LATE',
      'Reports about a rider close 7 days after delivery. Contact the store admin.',
    );
  const reason = req.body?.reason;
  if (!RIDER_REPORT_REASONS.includes(reason)) throw invalid({ reason: 'Pick what happened.' });
  const note = text(req.body?.note, 500);
  if (note.length < 3) throw invalid({ note: 'Tell us what happened.' });

  const feedback =
    (await RiderFeedback.findOne({ order: order._id, rider: order.rider })) ??
    new RiderFeedback({ order: order._id, rider: order.rider, user: req.user._id });
  if (feedback.report)
    throw new AppError(
      409,
      'ALREADY_REPORTED',
      'You already reported this rider for this order. An admin is on it.',
    );
  feedback.report = { reason, note, at: new Date() };
  await saveOnce(feedback);

  await holdRider(
    order.rider,
    `Reported on ${orderLabel(order)}`,
    'A buyer reported one of your deliveries. Tell us your side on your delivery profile: an admin reads both before deciding. Orders already out with you carry on.',
  );
  const rider = await User.findById(order.rider, 'name');
  const admins = await adminsFor('users');
  await notify(
    admins.map((user) => ({
      user,
      type: 'account',
      title: `A buyer reported ${rider?.name ?? 'a rider'}`,
      body: "They're paused from new deliveries until you clear them or deactivate the account.",
      link: `/admin/riders/${order.rider}`,
    })),
  );
  res.status(201).json({ feedback: buyerView(feedback) });
}

async function saveOnce(feedback) {
  try {
    await feedback.save();
  } catch (err) {
    if (err.code === 11000)
      throw new AppError(409, 'CONFLICT', 'This changed while you were sending it. Reload and try again.');
    throw err;
  }
}

// What the buyer sees of their own feedback: enough to show "Rated 4 stars" and "Reported".
export const buyerView = (feedback) =>
  feedback && {
    stars: feedback.stars ?? null,
    comment: feedback.comment ?? null,
    reported: Boolean(feedback.report),
  };

// ---- Admin ----

const RIDER_LIST_FIELDS = 'name email isActive createdAt riderProfile';


export async function getRider(req, res) {
  const rider = isId(req.params.id)
    ? await User.findOne({ _id: req.params.id, role: 'rider' }, RIDER_LIST_FIELDS)
    : null;
  if (!rider) throw notFound('That rider');
  const [stats, feedback, declined] = await Promise.all([
    riderStats(rider._id),
    RiderFeedback.find({ rider: rider._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'name')
      .populate('reviewedBy', 'name'),
    Order.find({ 'declines.rider': rider._id }, 'declines status').sort({ updatedAt: -1 }).limit(50),
  ]);
  const declines = declined
    .flatMap((o) =>
      o.declines
        .filter((d) => String(d.rider) === String(rider._id))
        .map((d) => ({ order: o._id, ...d.toObject() })),
    )
    .sort((a, b) => b.at - a.at);
  res.json({ rider, stats, feedback, declines });
}

// The review queue: low ratings, comments and reports nobody has looked at yet, oldest first.
export async function feedbackQueue(req, res) {
  const items = await RiderFeedback.find({ flagged: true, reviewedAt: null })
    .sort({ createdAt: 1 })
    .limit(100)
    .populate('rider', 'name riderProfile.heldAt')
    .populate('user', 'name');
  // Reports are about safety, so they go first; the rest stay oldest first.
  items.sort((a, b) => Boolean(b.report) - Boolean(a.report));
  // Vehicle changes waiting for approval sit in the same queue, oldest first.
  const vehicleRequests = await User.find(
    { role: 'rider', 'riderProfile.vehicleRequest': { $exists: true } },
    'name riderProfile.vehicle riderProfile.plate riderProfile.vehicleRequest',
  ).sort({ 'riderProfile.vehicleRequest.at': 1 });
  res.json({ items, vehicleRequests });
}

export async function markReviewed(req, res) {
  const feedback = isId(req.params.id)
    ? await RiderFeedback.findById(req.params.id).populate('rider', 'name')
    : null;
  if (!feedback) throw notFound('That rating');
  if (feedback.reviewedAt) return res.json({ feedback });
  feedback.reviewedAt = new Date();
  feedback.reviewedBy = req.user._id;
  const note = text(req.body?.note, 300);
  if (note) feedback.reviewNote = note;
  await feedback.save();
  // The rider's account may be gone since (feedback is kept); populate leaves null, but the id is still known.
  const riderName = feedback.rider?.name ?? 'a deleted rider';
  await record(req.user, {
    action: 'rider.feedback',
    target: { kind: 'user', id: feedback.rider?._id ?? feedback.populated('rider'), label: riderName },
    summary: `reviewed a ${feedback.report ? 'report' : 'rating'} about ${riderName}`,
    undoable: false,
  });
  res.json({ feedback });
}

// Clears a hold once an admin has looked into it, or puts one on by hand. Deactivating is the Users page's job.
export async function setHold(req, res) {
  const rider = isId(req.params.id) ? await User.findOne({ _id: req.params.id, role: 'rider' }) : null;
  if (!rider) throw notFound('That rider');
  const action = req.body?.action;
  const note = text(req.body?.note, 200);
  if (!['hold', 'clear'].includes(action)) throw invalid({ action: 'Choose hold or clear.' });
  if (note.length < 3) throw invalid({ note: 'Add a short note for the record.' });
  if (action === 'clear') {
    if (!rider.riderProfile?.heldAt) return res.json({ rider });
    await User.updateOne(
      { _id: rider._id },
      { $unset: { 'riderProfile.heldAt': 1, 'riderProfile.heldReason': 1 } },
    );
    await notify({
      user: rider._id,
      type: 'account',
      title: "You're back on deliveries",
      body: 'An admin finished looking into the report. New orders will come to you again.',
      link: '/deliveries',
    });
  } else {
    await holdRider(rider._id, note);
  }
  await record(req.user, {
    action: action === 'clear' ? 'rider.clear' : 'rider.hold',
    target: { kind: 'user', id: rider._id, label: rider.name },
    summary: `${action === 'clear' ? 'cleared the hold on' : 'paused'} ${rider.name}: ${note}`,
    undoable: false,
  });
  res.json({ rider: await User.findById(rider._id, RIDER_LIST_FIELDS) });
}

// For the order page: the rider as each viewer may see them. Buyers get a first name, plus the vehicle and plate
// while the order is on the way; nobody but admins gets the rider's phone.
export function riderForViewer(rider, order, { isAdmin, isCustomer }) {
  if (!rider || isAdmin) return rider;
  const onTheWay = ON_THE_WAY.includes(order.status);
  // Once out for delivery, what the rider set out with; before pickup, their profile (which can't change meanwhile).
  const p = order.riderVehicle?.vehicle ? order.riderVehicle : (rider.riderProfile ?? {});
  return {
    _id: rider._id,
    name: isCustomer ? rider.name.split(' ')[0] : rider.name,
    ...(onTheWay && { riderProfile: { vehicle: p.vehicle, plate: p.plate } }),
  };
}
