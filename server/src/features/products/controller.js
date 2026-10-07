import path from 'node:path';
import mongoose from 'mongoose';
import { Order, Product } from '../../models/index.js';
import { CATEGORIES, CONNECTIVITY, LAYOUTS, RESOLUTIONS, SWITCH_TYPES } from '../../models/Product.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { escapeRegex, pageParams, paginate, pick, sameId } from '../../lib/request.js';
import { deleteFile, isAllowedAssetUrl, saveFile } from '../../lib/storage.js';
import { canManage } from '../../middleware/auth.js';
import { record } from '../activity/service.js';
import { cleanSpecs, searchFilter, searchScore, relatedProducts, suggestSearch } from './service.js';

const EDITABLE = ['name', 'brand', 'category', 'description', 'priceCents', 'compareAtCents', 'stock', 'specs', 'images', 'modelUrl'];
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
const MAX_FEATURED = 8;
const MB = 1024 * 1024;
// A sale's struck-through price can't be above the lowest regular price of this many days (the rule the
// EU's Omnibus Directive sets), so a seller can't raise the price and then "discount" it back down.
const PRICE_LOOKBACK_DAYS = 30;

// Deletes stored files no product or order still points at. Any seller can reference any /api/files/
// or Cloudinary URL, so without this check dropping a borrowed URL would delete another shop's asset.
async function deleteUnreferenced(files) {
  await Promise.all(
    files.map(async (file) => {
      const url = file?.url;
      if (!url) return;
      const inUse = await Promise.all([
        Product.exists({ $or: [{ 'images.url': url }, { modelUrl: url }] }),
        Order.exists({ 'items.image': url }),
      ]);
      if (!inUse.some(Boolean)) await deleteFile({ url });
    }),
  );
}

// Lets Vercel's CDN keep a response for a minute (and serve it stale for five more while it refetches),
// so most visitors skip the round trip to Render. Only for responses that are the same for everyone:
// browsers don't cache it, and nothing here depends on who's asking.
const shareForAMinute = (res) => res.set('CDN-Cache-Control', 'max-age=60, stale-while-revalidate=300');

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
  if (q.onSale === '1') filter.compareAtCents = { $gt: 0 };
  if (q.q) Object.assign(filter, searchFilter(String(q.q).slice(0, 80)));

  // A search with no sort chosen comes back best match first; everything else uses the chosen order.
  const bestMatch = q.q && (!q.sort || q.sort === 'relevance');
  const [result, brands] = await Promise.all([
    bestMatch
      ? rankedPage(filter, searchScore(String(q.q).slice(0, 80)), pageParams(q))
      : paginate(Product, filter, pageParams(q), (query) =>
          query.sort(Object.hasOwn(SORTS, q.sort) ? SORTS[q.sort] : SORTS.newest).populate('seller', SELLER_FIELDS),
        ),
    Product.distinct('brand', { isActive: true }),
  ]);
  // A search that found nothing offers a corrected spelling, but only one that finds something under the same
  // filters (the guess's $and replaces the original search's).
  let suggestion;
  if (q.q && result.total === 0) {
    const guess = await suggestSearch(String(q.q).slice(0, 80));
    if (guess && (await Product.exists({ ...filter, ...searchFilter(guess) }))) suggestion = guess;
  }
  const related =
    q.q && result.page === 1
      ? await relatedProducts(filter, String(q.q).slice(0, 80), { path: 'seller', select: SELLER_FIELDS })
      : [];
  res.json({ ...result, brands: brands.sort(), ...(suggestion && { suggestion }), ...(related.length && { related }) });
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

export async function myProducts(req, res) {
  const items = await Product.find({ seller: req.user._id }).sort({ updatedAt: -1 });
  res.json({ items });
}

export async function getProduct(req, res) {
  const product = await Product.findOne({ slug: req.params.slug }).populate(
    'seller',
    'name sellerProfile.shopName sellerProfile.slug sellerProfile.logoUrl',
  );
  if (!product) throw notFound('That product');
  if (!product.isActive && !canManage(req.user, 'products') && !sameId(product.seller, req.user)) {
    throw notFound('That product');
  }
  res.json({ product });
}

// Whitelists the editable fields, strips specs that don't belong to the category, and only accepts
// asset URLs this app stored itself.
function productInput(body, current) {
  const data = pick(body, EDITABLE);
  const category = data.category ?? current?.category;
  if ('specs' in data || 'category' in data) {
    data.specs = cleanSpecs(category, data.specs ?? current?.specs?.toObject?.() ?? {});
  }
  if ('images' in data) {
    if (!Array.isArray(data.images)) throw invalid({ images: 'Images must be a list.' });
    // publicId is not accepted from the client; deletes derive it from the vetted URL.
    data.images = data.images.map((img) => pick(img, ['url', 'alt']));
    if (data.images.some((img) => !isAllowedAssetUrl(img.url))) {
      throw invalid({ images: 'Upload images through the product form.' });
    }
  }
  // null or 0 ends a sale.
  if ('compareAtCents' in data && !data.compareAtCents) data.compareAtCents = undefined;
  if ('modelUrl' in data) {
    if (data.modelUrl === '' || data.modelUrl === null) data.modelUrl = undefined;
    else if (!isAllowedAssetUrl(data.modelUrl)) throw invalid({ modelUrl: 'Upload the 3D model through the product form.' });
  }
  return data;
}

const regularPrice = (product) => product.compareAtCents ?? product.priceCents;
const pesos = (cents) => `₱${(cents / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// The lowest regular price over the lookback window: the price in effect when it began, and every
// change since. Products from before the log existed fall back to their price before this edit.
function lowestRecentRegular(log, current, now) {
  const start = now - PRICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const entries = log?.length ? log : [{ cents: current, at: new Date(0) }];
  const inEffect = entries.filter((e) => e.at.getTime() <= start).at(-1);
  return Math.min(...entries.filter((e) => e.at.getTime() > start || e === inEffect).map((e) => e.cents));
}

// Keeps the entry in effect when the window starts, so the next check still knows that price.
function trimPriceLog(log, now) {
  const start = now - PRICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const firstRecent = log.findIndex((e) => e.at.getTime() > start);
  if (firstRecent === -1) return log.slice(-1);
  return log.slice(Math.max(0, firstRecent - 1));
}

export async function createProduct(req, res) {
  const data = productInput(req.body ?? {});
  const priceLog = [{ cents: data.compareAtCents ?? data.priceCents, at: new Date() }];
  const product = await Product.create({ ...data, priceLog, seller: req.user._id });
  res.status(201).json({ product });
}

async function loadOwnProduct(req) {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id }).select('+priceLog');
  if (!product) throw notFound('That product');
  return product;
}

export async function updateProduct(req, res) {
  const product = await loadOwnProduct(req);
  const body = req.body ?? {};
  const before = { images: product.images.map((img) => img.toObject()), modelUrl: product.modelUrl };

  const regularBefore = regularPrice(product);
  Object.assign(product, productInput(body, product));
  const now = Date.now();
  if (product.compareAtCents && (product.isModified('compareAtCents') || product.isModified('priceCents'))) {
    const lowest = lowestRecentRegular(product.priceLog, regularBefore, now);
    if (product.compareAtCents > lowest) {
      throw invalid({
        compareAtCents: `The regular price can be at most ${pesos(lowest)}, its lowest in the last ${PRICE_LOOKBACK_DAYS} days.`,
      });
    }
  }
  if (regularPrice(product) !== regularBefore) {
    const log = product.priceLog?.length ? product.priceLog : [{ cents: regularBefore, at: new Date(0) }];
    product.priceLog = trimPriceLog([...log, { cents: regularPrice(product), at: new Date(now) }], now);
  }
  if (typeof body.isActive === 'boolean' && body.isActive !== product.isActive) {
    if (body.isActive) {
      if (product.unlistedBy === 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'An admin unlisted this product, so only an admin can relist it.');
      }
      product.isActive = true;
      product.unlistedBy = undefined;
    } else {
      product.isActive = false;
      product.unlistedBy = 'seller';
      product.isFeatured = false;
    }
  }
  await product.save();

  const keptUrls = new Set(product.images.map((img) => img.url));
  const removed = before.images.filter((img) => !keptUrls.has(img.url));
  if (before.modelUrl && before.modelUrl !== product.modelUrl) removed.push({ url: before.modelUrl });
  await deleteUnreferenced(removed);
  res.json({ product });
}

export async function deleteProduct(req, res) {
  const product = await loadOwnProduct(req);
  if (await Order.exists({ 'items.product': product._id })) {
    // Past orders reference it, so keep the document and hide it instead.
    Object.assign(product, { isActive: false, unlistedBy: 'seller', isFeatured: false });
    await product.save();
    return res.json({ archived: true });
  }
  await product.deleteOne();
  const files = product.images.map((img) => img.toObject());
  if (product.modelUrl) files.push({ url: product.modelUrl });
  await deleteUnreferenced(files);
  res.json({ deleted: true });
}

export async function moderateProduct(req, res) {
  const product = await Product.findById(req.params.id).populate('seller', 'isActive role sellerProfile.status');
  if (!product) throw notFound('That product');
  const { isActive, isFeatured } = req.body ?? {};
  const before = { isActive: product.isActive, isFeatured: product.isFeatured, unlistedBy: product.unlistedBy };

  if (typeof isActive === 'boolean' && isActive !== product.isActive) {
    if (isActive) {
      const seller = product.seller;
      if (!seller?.isActive || seller.role !== 'seller' || seller.sellerProfile?.status !== 'approved') {
        throw new AppError(409, 'CONFLICT', "The seller's account isn't active, so this product can't be relisted.");
      }
      product.isActive = true;
      product.unlistedBy = undefined;
    } else {
      Object.assign(product, { isActive: false, unlistedBy: 'admin', isFeatured: false });
    }
  }

  if (typeof isFeatured === 'boolean' && isFeatured !== product.isFeatured) {
    if (isFeatured) {
      if (!product.isActive) throw new AppError(409, 'CONFLICT', 'Only listed products can be featured.');
      const featured = await Product.countDocuments({ isFeatured: true, _id: { $ne: product._id } });
      if (featured >= MAX_FEATURED) {
        throw new AppError(409, 'CONFLICT', `You can feature at most ${MAX_FEATURED} products. Unfeature one first.`);
      }
    }
    product.isFeatured = isFeatured;
  }

  const after = { isActive: product.isActive, isFeatured: product.isFeatured };
  if (after.isActive === before.isActive && after.isFeatured === before.isFeatured) return res.json({ product });
  const did = [
    after.isActive !== before.isActive && (after.isActive ? 'relisted' : 'unlisted'),
    after.isFeatured !== before.isFeatured && (after.isFeatured ? 'featured' : 'unfeatured'),
  ].filter(Boolean);
  await mongoose.connection.transaction(async (session) => {
    await product.save({ session });
    await record(
      req.user,
      {
        action: 'product.moderate',
        target: { kind: 'product', id: product._id, label: product.name },
        summary: `${did.join(' and ')} ${product.name}`,
        undo: { before, after },
      },
      session,
    );
  });
  res.json({ product });
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

// Sniff the real image type from its magic bytes; the extension and MIME type are client-controlled.
function imageTypeOf(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

export async function upload(req, res) {
  if (!req.file) throw invalid({ file: 'Choose a file to upload.' });
  const ext = path.extname(req.file.originalname).toLowerCase().slice(1);
  let kind;
  let storedExt = ext;
  if (IMAGE_EXTS.includes(ext)) {
    if (req.file.size > 2 * MB) throw new AppError(413, 'FILE_TOO_LARGE', 'Images must be 2 MB or smaller.');
    storedExt = imageTypeOf(req.file.buffer);
    if (!storedExt) throw invalid({ file: 'That is not a valid JPG, PNG or WebP image.' });
    kind = 'image';
  } else if (ext === 'glb') {
    // Browsers send .glb as octet-stream, so check the binary glTF magic bytes instead of the MIME type.
    if (req.file.buffer.subarray(0, 4).toString('latin1') !== 'glTF') throw invalid({ file: 'That is not a valid .glb file.' });
    kind = 'model';
  } else {
    throw invalid({ file: 'Upload a JPG, PNG or WebP image, or a .glb 3D model.' });
  }
  const stored = await saveFile(req.file.buffer, { ext: storedExt, kind });
  res.status(201).json(stored);
}
