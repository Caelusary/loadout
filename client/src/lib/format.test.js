import { describe, expect, it } from 'vitest';
import { formatMoney, parsePesos } from './format.js';

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
