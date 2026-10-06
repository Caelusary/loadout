import Product from '../../models/Product.js';
import { escapeRegex } from '../../lib/request.js';

// Used when a seller is suspended, deactivated or deleted. Reinstating a seller does not relist:
// the admin relists products one by one. Returns the ids it unlisted, so the owner's undo can relist them.
export async function unlistSellerProducts(sellerId, session) {
  const listed = await Product.find({ seller: sellerId, isActive: true }, '_id', { session }).lean();
  const ids = listed.map((p) => p._id);
  if (ids.length) {
    await Product.updateMany({ _id: { $in: ids } }, { isActive: false, unlistedBy: 'admin', isFeatured: false }, { session });
  }
  return ids;
}

// Undo's other half: relists only the products still sitting unlisted by an admin.
export const relistProducts = (ids, session) =>
  ids?.length
    ? Product.updateMany(
        { _id: { $in: ids }, isActive: false, unlistedBy: 'admin' },
        { isActive: true, $unset: { unlistedBy: 1 } },
        { session },
      )
    : null;

// Spec fields that make sense for each category; anything else is dropped on save.
export const SPEC_FIELDS = {
  keyboard: ['connectivity', 'switchType', 'layout', 'pollingRateHz', 'weightGrams', 'batteryMah'],
  mouse: ['connectivity', 'sensor', 'dpiMax', 'pollingRateHz', 'weightGrams', 'batteryMah'],
  headset: ['connectivity', 'weightGrams', 'batteryMah'],
  webcam: ['connectivity', 'resolution', 'fps'],
  mousepad: ['weightGrams'],
  accessory: ['connectivity'],
};

export function cleanSpecs(category, specs) {
  const allowed = SPEC_FIELDS[category] ?? [];
  const out = {};
  for (const key of allowed) {
    const value = specs?.[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

// Words people type for a category, mapped to the stored value.
const CATEGORY_WORDS = {
  keyboard: 'keyboard', keyboards: 'keyboard', keeb: 'keyboard', keebs: 'keyboard',
  mouse: 'mouse', mice: 'mouse', mouses: 'mouse',
  headset: 'headset', headsets: 'headset', headphone: 'headset', headphones: 'headset',
  webcam: 'webcam', webcams: 'webcam', camera: 'webcam', cam: 'webcam',
  mousepad: 'mousepad', mousepads: 'mousepad', pad: 'mousepad', pads: 'mousepad', deskmat: 'mousepad',
  accessory: 'accessory', accessories: 'accessory', cable: 'accessory', cables: 'accessory',
};
const STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'of', 'in', 'my']);
const SPEC_TEXT = ['specs.connectivity', 'specs.switchType', 'specs.layout', 'specs.resolution', 'specs.sensor'];

// Turns a typed search into a Mongo filter: every word must match the name, brand, description,
// category, or a spec value, so "wireless mouse" finds wireless mice even though neither word is in
// their names. At most six words, each a literal (escaped) pattern.
const searchWords = (text) =>
  String(text)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/%$/, ''))
    .filter((w) => w && !STOP_WORDS.has(w))
    .slice(0, 6);

// Descriptions are long prose, so there a word only counts at the start of a word and only when it's
// at least 4 letters: "pro" still finds "Pro" in a name, but no longer every "product" in a description.
// Connectivity words come from the spec alone: a wired light bar whose description mentions its
// "wireless dial" isn't a wireless product.
const CONNECTIVITY_WORDS = new Set(['wired', 'wireless', 'bluetooth', 'tri-mode', 'trimode']);
const descriptionMatch = (word) =>
  word.length >= 4 && !CONNECTIVITY_WORDS.has(word) ? [{ description: new RegExp(`\\b${escapeRegex(word)}`, 'i') }] : [];

export function searchFilter(text) {
  const words = searchWords(text);
  if (!words.length) return {};
  return {
    $and: words.map((word) => {
      // Words match from the start of a word, so "pad" finds "Speed Pad" but not "Numpad".
      const re = new RegExp(`\\b${escapeRegex(word)}`, 'i');
      const or = [{ name: re }, { brand: re }, ...descriptionMatch(word), ...SPEC_TEXT.map((f) => ({ [f]: re }))];
      if (CATEGORY_WORDS[word]) or.push({ category: CATEGORY_WORDS[word] });
      return { $or: or };
    }),
  };
}

// "Best match" order: each word found in the name counts 3, in the brand 2, anywhere else 0, so
// products named for the search come before ones that only mention it.
export function searchScore(text) {
  const words = searchWords(text);
  const hit = (field, word, points) => ({
    $cond: [{ $regexMatch: { input: `$${field}`, regex: `\\b${escapeRegex(word)}`, options: 'i' } }, points, 0],
  });
  return words.length ? { $add: words.flatMap((word) => [hit('name', word, 3), hit('brand', word, 2)]) } : 0;
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// "Did you mean": for a search that found nothing, swaps each word that matches nothing in the catalog
// for the closest word that does (one typo for short words, two for longer ones). Null when no word
// changes, or nothing close enough exists.
export async function suggestSearch(text) {
  const words = searchWords(text);
  if (!words.length) return null;
  const products = await Product.find({ isActive: true }, 'name brand specs').lean();
  const vocab = new Set(Object.keys(CATEGORY_WORDS));
  for (const p of products) {
    const specText = SPEC_TEXT.map((f) => p.specs?.[f.slice(6)]).filter((v) => typeof v === 'string');
    for (const token of [p.name, p.brand, ...specText].join(' ').toLowerCase().split(/[^a-z0-9-]+/)) {
      if (token.length >= 3) vocab.add(token);
    }
  }
  const tokens = [...vocab];
  let changed = false;
  const fixed = words.map((word) => {
    if (tokens.some((t) => t.startsWith(word))) return word;
    const limit = word.length <= 4 ? 1 : 2;
    let best = null;
    let bestDistance = limit + 1;
    for (const t of tokens) {
      if (Math.abs(t.length - word.length) > limit) continue;
      const d = editDistance(word, t);
      if (d < bestDistance) [best, bestDistance] = [t, d];
    }
    if (!best) return word;
    changed = true;
    return best;
  });
  return changed ? fixed.join(' ') : null;
}

// "Related" under a search: products that aren't results but come close. First ones where a word shows up
// anywhere in the name or brand ("pad" in "Numpad"), then others from the results' categories. Price
// and spec filters don't apply, so this can surface alternatives the filters hid.
export async function relatedProducts(exactFilter, text, populate, limit = 8) {
  const words = searchWords(text);
  if (!words.length) return [];
  const exact = await Product.find(exactFilter, 'category').lean();
  const seen = exact.map((p) => p._id);
  const categories = [...new Set(exact.map((p) => p.category))];
  const near = words.flatMap((word) => {
    const re = new RegExp(escapeRegex(word), 'i');
    return [{ name: re }, { brand: re }];
  });
  const close = await Product.find({ isActive: true, _id: { $nin: seen }, $or: near })
    .sort({ ratingAvg: -1, _id: 1 })
    .limit(limit)
    .populate(populate);
  if (close.length >= limit || !categories.length) return close;
  const sameCategory = await Product.find({
    isActive: true,
    _id: { $nin: [...seen, ...close.map((p) => p._id)] },
    category: { $in: categories },
  })
    .sort({ ratingAvg: -1, _id: 1 })
    .limit(limit - close.length)
    .populate(populate);
  return [...close, ...sameCategory];
}
