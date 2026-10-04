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
  keyboard: 'keyboard', keyboards: 'keyboard', keeb: 'keyboard', keebs: 'keyboard', numpad: 'accessory',
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
const descriptionMatch = (word) =>
  word.length >= 4 ? [{ description: new RegExp(`\\b${escapeRegex(word)}`, 'i') }] : [];

export function searchFilter(text) {
  const words = searchWords(text);
  if (!words.length) return {};
  return {
    $and: words.map((word) => {
      const re = new RegExp(escapeRegex(word), 'i');
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
    $cond: [{ $regexMatch: { input: `$${field}`, regex: escapeRegex(word), options: 'i' } }, points, 0],
  });
  return words.length ? { $add: words.flatMap((word) => [hit('name', word, 3), hit('brand', word, 2)]) } : 0;
}
