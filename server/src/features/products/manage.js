// A seller's own products: their list, adding, editing, removing, and uploading photos and 3D models.
import path from 'node:path';
import { Order, Product } from '../../models/index.js';
import { AppError, invalid, notFound } from '../../lib/AppError.js';
import { IMAGE_EXTS, imageTypeOf, MB } from '../../lib/images.js';
import { pick } from '../../lib/request.js';
import { deleteUnused } from '../../lib/pendingPhotos.js';
import { isAllowedAssetUrl, saveFile } from '../../lib/storage.js';
import { cleanSpecs } from './service.js';
import { lowestRecentRegular, pesos, PRICE_LOOKBACK_DAYS, regularPrice, scheduleSale, trimPriceLog } from './pricing.js';

const EDITABLE = ['name', 'brand', 'category', 'description', 'priceCents', 'compareAtCents', 'stock', 'specs', 'images', 'modelUrl'];

// Deletes stored files nothing still points at (see fileInUse).
const deleteUnreferenced = (files) => deleteUnused(files.map((file) => file?.url));

// Review and delivery photos live in their own folders and can't be put on a product: that would show a buyer's
// door photo on a public page.
const isProductAsset = (url) => isAllowedAssetUrl(url) && !/\/loadout\/(reviews|proofs)\//.test(url);

export async function myProducts(req, res) {
  const items = await Product.find({ seller: req.user._id }).select('+upcomingSale').sort({ updatedAt: -1 });
  res.json({ items });
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
    if (data.images.some((img) => !isProductAsset(img.url))) {
      throw invalid({ images: 'Upload images through the product form.' });
    }
  }
  // null or 0 ends a sale.
  if ('compareAtCents' in data && !data.compareAtCents) data.compareAtCents = undefined;
  if ('modelUrl' in data) {
    if (data.modelUrl === '' || data.modelUrl === null) data.modelUrl = undefined;
    else if (!isProductAsset(data.modelUrl)) throw invalid({ modelUrl: 'Upload the 3D model through the product form.' });
  }
  return data;
}

export async function createProduct(req, res) {
  const body = req.body ?? {};
  const data = productInput(body);
  const priceLog = [{ cents: data.compareAtCents ?? data.priceCents, at: new Date() }];
  const product = new Product({ ...data, priceLog, seller: req.user._id });
  scheduleSale(product, body, new Date());
  await product.save();
  res.status(201).json({ product });
}

async function loadOwnProduct(req) {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id }).select('+priceLog +upcomingSale');
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
  scheduleSale(product, body, new Date(now));
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
