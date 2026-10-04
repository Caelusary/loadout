import { describe, expect, it } from 'vitest';
import { cartReducer } from './cart.js';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

describe('cartReducer', () => {
  it('merges adds of the same product and caps the quantity at 10', () => {
    let items = cartReducer([], { type: 'add', productId: A, qty: 4 });
    items = cartReducer(items, { type: 'add', productId: A, qty: 9 });
    expect(items).toEqual([{ productId: A, qty: 10 }]);
  });

  it('never sets a quantity below 1', () => {
    const items = cartReducer([{ productId: A, qty: 3 }], { type: 'set', productId: A, qty: 0 });
    expect(items[0].qty).toBe(1);
  });

  it('removes only the targeted product', () => {
    const items = cartReducer(
      [
        { productId: A, qty: 1 },
        { productId: B, qty: 2 },
      ],
      { type: 'remove', productId: A },
    );
    expect(items).toEqual([{ productId: B, qty: 2 }]);
  });

  it('treats junk quantities as 1 and truncates fractions', () => {
    expect(cartReducer([], { type: 'add', productId: A, qty: 'abc' })).toEqual([{ productId: A, qty: 1 }]);
    expect(cartReducer([], { type: 'add', productId: A })).toEqual([{ productId: A, qty: 1 }]);
    expect(cartReducer([{ productId: A, qty: 2 }], { type: 'set', productId: A, qty: 3.9 })).toEqual([{ productId: A, qty: 3 }]);
    expect(cartReducer([{ productId: A, qty: 2 }], { type: 'set', productId: A, qty: 99 })).toEqual([{ productId: A, qty: 10 }]);
  });

  it('ignores a set for a product that is not in the cart', () => {
    const items = [{ productId: A, qty: 2 }];
    expect(cartReducer(items, { type: 'set', productId: B, qty: 5 })).toEqual(items);
  });

  it('clears, replaces with the server copy, and leaves state alone on unknown actions', () => {
    const items = [{ productId: A, qty: 2 }];
    expect(cartReducer(items, { type: 'clear' })).toEqual([]);
    expect(cartReducer(items, { type: 'replace', items: [{ productId: B, qty: 1 }] })).toEqual([{ productId: B, qty: 1 }]);
    expect(cartReducer(items, { type: 'nope' })).toBe(items);
  });
});
