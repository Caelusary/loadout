import { CONNECTIVITY_LABELS, LAYOUT_LABELS, RESOLUTION_LABELS, SWITCH_LABELS } from './constants.js';

const pesoWhole = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const pesoCents = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });

// Whole pesos drop the ".00" so prices stay short in tiles; anything with centavos shows both digits.
export function formatMoney(cents) {
  if (!Number.isFinite(cents)) return '';
  return cents % 100 === 0 ? pesoWhole.format(cents / 100) : pesoCents.format(cents / 100);
}

// Parses what a seller types in a price field ("6490", "6,490.50", "₱ 6,490") into centavos.
// Returns NaN for anything that isn't a non-negative amount with at most two decimals.
export function parsePesos(text) {
  const cleaned = String(text ?? '')
    .replace(/[₱,\s]/g, '')
    .replace(/^PHP/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const centsToPesoInput = (cents) => (Number.isFinite(cents) ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '');

const dateFormat = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '');
export const formatDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : '');

export const orderNumber = (id) => `#${String(id).slice(-6).toUpperCase()}`;

const number = new Intl.NumberFormat('en-PH');

const SPEC_FORMATTERS = {
  connectivity: (v) => CONNECTIVITY_LABELS[v] ?? v,
  switchType: (v) => SWITCH_LABELS[v] ?? v,
  layout: (v) => LAYOUT_LABELS[v] ?? v,
  resolution: (v) => RESOLUTION_LABELS[v] ?? v,
  pollingRateHz: (v) => `${number.format(v)} Hz`,
  dpiMax: (v) => `${number.format(v)} DPI`,
  weightGrams: (v) => `${number.format(v)} g`,
  batteryMah: (v) => `${number.format(v)} mAh`,
  fps: (v) => `${v} fps`,
  sensor: (v) => v,
};

export const SPEC_NAMES = {
  connectivity: 'Connectivity',
  switchType: 'Switch type',
  layout: 'Layout',
  resolution: 'Resolution',
  pollingRateHz: 'Polling rate',
  dpiMax: 'Max DPI',
  weightGrams: 'Weight',
  batteryMah: 'Battery',
  fps: 'Frame rate',
  sensor: 'Sensor',
};

export const formatSpec = (key, value) => (SPEC_FORMATTERS[key] ?? String)(value);

export const initials = (text = '') =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

// Shipping isn't refunded, so an order counts as fully refunded once refunds cover what was paid for the items.
export function refundLevel(order) {
  if (!(order.refundedCents > 0)) return null;
  const paidForItems = (order.subtotalCents ?? 0) - (order.discountCents ?? 0);
  return order.refundedCents >= paidForItems ? 'full' : 'partial';
}
