// What shoppers see: the product list with its search and filters, the featured strip and one product's page.
import mongoose from 'mongoose';
import { Product } from '../../models/index.js';
import { CATEGORIES, CONNECTIVITY, LAYOUTS, RESOLUTIONS, SWITCH_TYPES } from '../../models/Product.js';
import { notFound } from '../../lib/AppError.js';
import { escapeRegex, pageParams, paginate, sameId } from '../../lib/request.js';
import { canManage } from '../../middleware/auth.js';
import { cheapFilter, searchFilter, searchIntent, searchScore, relatedProducts, suggestSearch } from './service.js';

const SELLER_FIELDS = 'sellerProfile.shopName sellerProfile.slug';
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  'price-asc': { priceCents: 1, _id: 1 },
  'price-desc': { priceCents: -1, _id: 1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: 1 },
};
const SPEC_FILTERS = {
  switchType: SWITCH_TYPES,
  connectivity: CONNECTIVITY,
  layout: LAYOUTS,
  resolution: RESOLUTIONS,
};

export const MAX_FEATURED = 8;

// Lets Vercel's CDN keep a response for a minute (and serve it stale for five more while it refetches),
// so most visitors skip the round trip to Render. Only for responses that are the same for everyone:
// browsers don't cache it, and nothing here depends on who's asking.
const shareForAMinute = (res) => res.set('CDN-Cache-Control', 'max-age=60, stale-while-revalidate=300');

const ADMIN_STATUS = {
  listed: { isActive: true },
  featured: { isActive: true, isFeatured: true },
  unlisted: { isActive: false },
};

export async function listProducts(req, res) {
  const q = req.query;

  // Cart refresh: current price and stock for specific products. Unlisted ones come back as stubs.
  if (q.ids) {
    const ids = String(q.ids)
      .split(',')
      .filter((id) => mongoose.isValidObjectId(id))
      .slice(0, 50);
    const found = await Product.find({ _id: { $in: ids } }).populate('seller', SELLER_FIELDS);
    const items = found.map((p) => (p.isActive ? p : { _id: p._id, name: p.name, isActive: false }));
    return res.json({ items, page: 1, pages: 1, total: items.length });
  }

  const filter = {};
  if (!(canManage(req.user, 'products') && q.includeInactive === '1')) filter.isActive = true;
  // The admin's list with unlisted products differs per viewer, so it's never shared.
  if (q.includeInactive === undefined) shareForAMinute(res);
  if (CATEGORIES.includes(q.category)) filter.category = q.category;
  if (q.brand) filter.brand = new RegExp(`^${escapeRegex(q.brand)}$`, 'i');
  for (const [key, allowed] of Object.entries(SPEC_FILTERS)) {
    if (allowed.includes(q[key])) filter[`specs.${key}`] = q[key];
  }
  const min = Number(q.minPrice);
  const max = Number(q.maxPrice);
  if (q.minPrice && Number.isFinite(min)) filter.priceCents = { ...filter.priceCents, $gte: Math.round(min * 100) };
  if (q.maxPrice && Number.isFinite(max)) filter.priceCents = { ...filter.priceCents, $lte: Math.round(max * 100) };
  if (q.inStock === '1') filter.stock = { $gt: 0 };
  // "sale" and "cheap" in a search act as filters; the rest of the words search as usual.
  const intent = searchIntent(String(q.q ?? '').slice(0, 80));
  const term = intent.text;
  if (q.onSale === '1' || intent.sale) filter.compareAtCents = { $gt: 0 };
  if (intent.cheap) Object.assign(filter, await cheapFilter({ isActive: true }));
  if (term) Object.assign(filter, searchFilter(term));
  // The admin's list has status tabs, each counted over the same search.
  let counts;
  if (canManage(req.user, 'products') && q.includeInactive === '1') {
    const tallies = await Promise.all([
      Product.countDocuments(filter),
      ...Object.values(ADMIN_STATUS).map((s) => Product.countDocuments({ ...filter, ...s })),
    ]);
    counts = { '': tallies[0], ...Object.fromEntries(Object.keys(ADMIN_STATUS).map((k, i) => [k, tallies[i + 1]])) };
    if (Object.hasOwn(ADMIN_STATUS, q.status)) Object.assign(filter, ADMIN_STATUS[q.status]);
  }

  // A search with no sort chosen comes back best match first (cheapest first when it asked for cheap);
  // everything else uses the chosen order.
  const unsorted = !q.sort || q.sort === 'relevance';
  const sort = unsorted && intent.cheap ? 'price-asc' : q.sort;
  const bestMatch = term && unsorted && !intent.cheap;
  const [result, brands] = await Promise.all([
    bestMatch
      ? rankedPage(filter, searchScore(term), pageParams(q))
      : paginate(Product, filter, pageParams(q), (query) =>
          query.sort(Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.newest).populate('seller', SELLER_FIELDS),
        ),
    Product.distinct('brand', { isActive: true }),
  ]);
  // A search that found nothing offers a corrected spelling, but only one that finds something under the same
  // filters (the guess's $and replaces the original search's).
  let suggestion;
  if (term && result.total === 0) {
    const guess = await suggestSearch(term);
    if (guess && (await Product.exists({ ...filter, ...searchFilter(guess) }))) {
      suggestion = [intent.sale && 'sale', intent.cheap && 'cheap', guess].filter(Boolean).join(' ');
    }
  }
  const related =
    term && result.page === 1 ? await relatedProducts(filter, term, { path: 'seller', select: SELLER_FIELDS }) : [];
  const priceIntent = intent.sale || intent.cheap ? { sale: intent.sale, cheap: intent.cheap } : undefined;
  res.json({
    ...result,
    brands: brands.sort(),
    ...(suggestion && { suggestion }),
    ...(related.length && { related }),
    ...(priceIntent && { intent: priceIntent }),
    ...(counts && { counts }),
  });
}

async function rankedPage(filter, score, { page, limit, skip }) {
  const [rows, total] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      { $addFields: { _score: score } },
      { $sort: { _score: -1, createdAt: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _score: 0 } },
    ]),
    Product.countDocuments(filter),
  ]);
  const items = await Product.populate(rows.map((row) => Product.hydrate(row)), { path: 'seller', select: SELLER_FIELDS });
  return { items, page, pages: Math.max(1, Math.ceil(total / limit)), total };
}

export async function featuredProducts(req, res) {
  const items = await Product.find({ isFeatured: true, isActive: true })
    .sort({ updatedAt: -1 })
    .limit(MAX_FEATURED)
    .populate('seller', SELLER_FIELDS);
  shareForAMinute(res);
  res.json({ items });
}

export async function getProduct(req, res) {
  const product = await Product.findOne({ slug: req.params.slug }).populate(
    'seller',
    'sellerProfile.shopName sellerProfile.slug sellerProfile.logoUrl', // the shop, not the person behind it
  );
  if (!product) throw notFound('That product');
  if (!product.isActive && !canManage(req.user, 'products') && !sameId(product.seller, req.user)) {
    throw notFound('That product');
  }
  res.json({ product });
}
