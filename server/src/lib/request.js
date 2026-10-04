import mongoose from 'mongoose';

// Copies only whitelisted keys, so fields like role, seller or ratingAvg can never be set from a request.
export function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    if (Object.hasOwn(source, key) && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function pageParams(query, { defaultLimit = 12, maxLimit = 48 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export async function paginate(model, filter, { page, limit, skip }, build = (q) => q) {
  const [items, total] = await Promise.all([
    build(model.find(filter)).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);
  return { items, page, pages: Math.max(1, Math.ceil(total / limit)), total };
}

export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);

// A populated ref may be a document, an ObjectId, or null when the referenced user was deleted.
const idOf = (ref) => ref?._id ?? ref ?? null;

export const sameId = (a, b) => {
  const x = idOf(a);
  const y = idOf(b);
  return Boolean(x && y) && x.toString() === y.toString();
};
