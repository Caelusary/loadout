// Sale and price-history rules for a seller's edits: the regular price can't be inflated before a sale, and a
// sale can start later or end on a set day.
import { invalid } from '../../lib/AppError.js';

// A sale's struck-through price can't be above the lowest regular price of this many days (the rule the
// EU's Omnibus Directive sets), so a seller can't raise the price and then "discount" it back down.
export const PRICE_LOOKBACK_DAYS = 30;

export const regularPrice = (product) => product.compareAtCents ?? product.priceCents;
export const pesos = (cents) => `₱${(cents / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// The lowest regular price over the lookback window: the price in effect when it began, and every
// change since. Products from before the log existed fall back to their price before this edit.
export function lowestRecentRegular(log, current, now) {
  const start = now - PRICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const entries = log?.length ? log : [{ cents: current, at: new Date(0) }];
  const inEffect = entries.filter((e) => e.at.getTime() <= start).at(-1);
  return Math.min(...entries.filter((e) => e.at.getTime() > start || e === inEffect).map((e) => e.cents));
}

// Keeps the entry in effect when the window starts, so the next check still knows that price.
export function trimPriceLog(log, now) {
  const start = now - PRICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const firstRecent = log.findIndex((e) => e.at.getTime() > start);
  if (firstRecent === -1) return log.slice(-1);
  return log.slice(Math.max(0, firstRecent - 1));
}

function saleDate(body, key) {
  const value = body[key];
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid({ [key]: 'Pick a date from the calendar.' });
  return date;
}

// The sale's dates from the form. A sale starting later waits in upcomingSale with the product at its regular
// price until then (settleSales starts it); one starting today or with no start runs now. Only touched when
// the request sends prices or dates, so toggling a listing leaves a schedule alone.
export function scheduleSale(product, body, now) {
  if (!['priceCents', 'compareAtCents', 'saleStartsAt', 'saleEndsAt'].some((key) => key in body)) return;
  const startsAt = saleDate(body, 'saleStartsAt');
  const endsAt = saleDate(body, 'saleEndsAt');
  product.upcomingSale = undefined;
  if (!product.compareAtCents) {
    product.saleEndsAt = undefined;
    return;
  }
  if (product.compareAtCents <= product.priceCents) {
    throw invalid({ compareAtCents: 'The regular price must be higher than the sale price' });
  }
  if (endsAt && endsAt <= now) throw invalid({ saleEndsAt: 'That day has already passed.' });
  if (startsAt && endsAt && endsAt <= startsAt) throw invalid({ saleEndsAt: 'The sale has to end after it starts.' });
  product.saleEndsAt = endsAt ?? undefined;
  if (startsAt && startsAt > now) {
    product.upcomingSale = { priceCents: product.priceCents, startsAt };
    product.priceCents = product.compareAtCents;
    product.compareAtCents = undefined;
  }
}
