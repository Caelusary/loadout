import { describe, expect, it } from 'vitest';
import * as client from '../../client/src/lib/constants.js';
import { CATEGORIES, CONNECTIVITY, LAYOUTS, RESOLUTIONS, SWITCH_TYPES } from '../src/models/Product.js';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../src/models/Order.js';
import { ADMIN_AREAS } from '../src/models/User.js';
import { RETURN_REASONS, RETURN_WINDOW_DAYS } from '../src/models/ReturnRequest.js';
import { MAX_QTY } from '../src/features/orders/cart.js';
import { FREE_SHIPPING_MIN_CENTS, SHIPPING_FEE_CENTS } from '../src/features/orders/shipping.js';
import { AUTO_DELIVER_DAYS } from '../src/features/orders/service.js';
import { REAPPLY_WAIT_MS } from '../src/features/users/service.js';

// The client keeps its own copy of these for display and form checks (it deploys separately, so it
// can't import server files). This fails the build the moment the two drift apart.
describe('client constants match the server', () => {
  it('has the same enums', () => {
    expect(client.CATEGORIES).toEqual(CATEGORIES);
    expect(client.CONNECTIVITY).toEqual(CONNECTIVITY);
    expect(client.SWITCH_TYPES).toEqual(SWITCH_TYPES);
    expect(client.LAYOUTS).toEqual(LAYOUTS);
    expect(client.RESOLUTIONS).toEqual(RESOLUTIONS);
    expect(client.ORDER_STATUSES).toEqual(ORDER_STATUSES);
    expect(client.PAYMENT_METHODS).toEqual(PAYMENT_METHODS);
    expect(Object.keys(client.ADMIN_AREA_LABELS)).toEqual(ADMIN_AREAS);
    expect(client.RETURN_REASONS.map((r) => r.value)).toEqual(RETURN_REASONS);
  });

  it('has the same numbers', () => {
    expect(client.MAX_QTY).toBe(MAX_QTY);
    expect(client.SHIPPING_FEE_CENTS).toBe(SHIPPING_FEE_CENTS);
    expect(client.FREE_SHIPPING_MIN_CENTS).toBe(FREE_SHIPPING_MIN_CENTS);
    expect(client.RETURN_WINDOW_DAYS).toBe(RETURN_WINDOW_DAYS);
    expect(client.AUTO_DELIVER_DAYS).toBe(AUTO_DELIVER_DAYS);
    expect(client.REAPPLY_WAIT_MS).toBe(REAPPLY_WAIT_MS);
  });
});
