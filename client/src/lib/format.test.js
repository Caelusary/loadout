import { describe, expect, it } from 'vitest';
import { formatMoney, parsePesos, refundLevel } from './format.js';

describe('parsePesos', () => {
  it('reads the formats sellers actually type', () => {
    expect(parsePesos('6490')).toBe(649000);
    expect(parsePesos('6,490.5')).toBe(649050);
    expect(parsePesos('₱ 1,190.05')).toBe(119005);
  });

  it('rejects negatives, extra decimals and text', () => {
    expect(parsePesos('-5')).toBeNaN();
    expect(parsePesos('12.345')).toBeNaN();
    expect(parsePesos('abc')).toBeNaN();
    expect(parsePesos('')).toBeNaN();
  });
});

describe('formatMoney', () => {
  it('hides centavos only when there are none', () => {
    expect(formatMoney(649000)).toBe('₱6,490');
    expect(formatMoney(649050)).toBe('₱6,490.50');
  });
});

describe('refundLevel', () => {
  const order = { subtotalCents: 500000, discountCents: 50000, shippingCents: 15000 };
  it('is full once refunds cover the items paid for, shipping aside', () => {
    expect(refundLevel({ ...order, refundedCents: 450000 })).toBe('full');
    expect(refundLevel({ ...order, refundedCents: 450001 })).toBe('full');
  });
  it('is partial below that, and null with no refund', () => {
    expect(refundLevel({ ...order, refundedCents: 200000 })).toBe('partial');
    expect(refundLevel({ ...order, refundedCents: 0 })).toBeNull();
    expect(refundLevel(order)).toBeNull();
  });
});
