import { Order, Product, ReturnRequest, User } from '../../models/index.js';
import { ORDER_STATUSES } from '../../models/Order.js';

const NET_SALES = {
  $subtract: ['$subtotalCents', { $add: [{ $ifNull: ['$discountCents', 0] }, { $ifNull: ['$refundedCents', 0] }] }],
};

const TZ = 'Asia/Manila';
const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function last30Days() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => dayKey.format(new Date(now - (29 - i) * DAY_MS)));
}

async function salesStats(match = {}) {
  const days = last30Days();
  const since = new Date(Date.now() - 30 * DAY_MS);
  const recent = { ...match, status: { $ne: 'cancelled' }, createdAt: { $gte: since } };

  const [statusRows, dayRows, productRows, refundRows] = await Promise.all([
    Order.aggregate([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: recent },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
          salesCents: { $sum: NET_SALES },
          orders: { $sum: 1 },
        },
      },
    ]),
   
    Order.aggregate([
      { $match: recent },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $last: '$items.name' },
          units: { $sum: '$items.qty' },
          salesCents: {
            $sum: {
              $multiply: [
                { $multiply: ['$items.priceCents', '$items.qty'] },
                {
                  $cond: [
                    { $gt: ['$subtotalCents', 0] },
                    { $divide: [{ $subtract: ['$subtotalCents', { $ifNull: ['$discountCents', 0] }] }, '$subtotalCents'] },
                    1,
                  ],
                },
              ],
            },
          },
        },
      },
    ]),
  
    ReturnRequest.aggregate([
      { $match: { ...match, status: 'refunded', createdAt: { $gte: since } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', units: { $sum: '$items.qty' }, refundCents: { $sum: '$items.refundCents' } } },
    ]),
  ]);
  const refunds = new Map(refundRows.map((r) => [String(r._id), r]));
  const topRows = productRows
    .map((r) => {
      const back = refunds.get(String(r._id));
      return { ...r, units: r.units - (back?.units ?? 0), salesCents: Math.round(r.salesCents) - (back?.refundCents ?? 0) };
    })
    .filter((r) => r.units > 0)
    .sort((a, b) => b.units - a.units || b.salesCents - a.salesCents)
    .slice(0, 5);

  const counts = new Map(statusRows.map((r) => [r._id, r.n]));
  const byDay = new Map(dayRows.map((r) => [r._id, r]));
  const salesByDay = days.map((date) => ({
    date,
    salesCents: byDay.get(date)?.salesCents ?? 0,
    orders: byDay.get(date)?.orders ?? 0,
  }));
  const stats = {
    salesCents30d: salesByDay.reduce((sum, d) => sum + d.salesCents, 0),
    orders30d: salesByDay.reduce((sum, d) => sum + d.orders, 0),
    ordersByStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, counts.get(s) ?? 0])),
    salesByDay,
    topProducts: topRows.map((r) => ({ productId: r._id, name: r.name, units: r.units, salesCents: r.salesCents })),
  };
  return { stats, since };
}

export async function sellerStats(req, res) {
  const [{ stats }, lowStock] = await Promise.all([
    salesStats({ seller: req.user._id }),
    Product.find({ seller: req.user._id, isActive: true, stock: { $lte: 5 } })
      .select('name slug stock')
      .sort({ stock: 1 })
      .limit(10),
  ]);
  res.json({ ...stats, lowStock });
}

export async function adminStats(req, res) {
  const { stats, since } = await salesStats();
  const [topSellers, pendingSellers, userCount, activeProducts] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since } } },
      { $group: { _id: '$seller', salesCents: { $sum: NET_SALES }, orders: { $sum: 1 } } },
      { $sort: { salesCents: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'owner' } },
      {
        $project: {
          _id: 0,
          sellerId: '$_id',
          salesCents: 1,
          orders: 1,
          shopName: { $ifNull: [{ $first: '$owner.sellerProfile.shopName' }, 'Deleted account'] },
        },
      },
    ]),
    User.countDocuments({ 'sellerProfile.status': 'pending' }),
    User.countDocuments(),
    Product.countDocuments({ isActive: true }),
  ]);
  res.json({ ...stats, topSellers, pendingSellers, userCount, activeProducts });
}
