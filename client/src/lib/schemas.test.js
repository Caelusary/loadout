import { describe, expect, it } from 'vitest';
import * as serverShipping from '../../../server/src/features/orders/shipping.js';
import { FREE_SHIPPING_MIN_CENTS, SHIPPING_FEE_CENTS, shippingFor } from './constants.js';
import { addressSchema, emailField, nameField } from './schemas.js';

const valid = {
  fullName: 'Mika Reyes',
  line1: 'Unit 12B, 88 Kalayaan Ave',
  city: 'Quezon City',
  province: 'Metro Manila',
  postalCode: '1101',
  phone: '09171234567',
};
const errorsFor = (patch) => {
  const result = addressSchema.safeParse({ ...valid, ...patch });
  return result.success ? {} : result.error.flatten().fieldErrors;
};

// The checkout form must accept exactly what server/src/models/address.js accepts, or shoppers either
// get a server error after submitting or are blocked from a valid address.
describe('addressSchema matches the server address rules', () => {
  it('accepts a normal address and strips phone punctuation the server would reject', () => {
    const parsed = addressSchema.parse({ ...valid, phone: '(0917) 123-4567' });
    expect(parsed.phone).toBe('09171234567');
    expect(addressSchema.parse({ ...valid, phone: '+639171234567' }).phone).toBe('+639171234567');
  });

  it('rejects blank and whitespace-only required fields', () => {
    for (const field of Object.keys(valid)) {
      expect(errorsFor({ [field]: '   ' })[field], field).toBeTruthy();
    }
  });

  it('enforces the same length limits', () => {
    expect(errorsFor({ fullName: 'a'.repeat(80) }).fullName).toBeUndefined();
    expect(errorsFor({ fullName: 'a'.repeat(81) }).fullName).toBeTruthy();
    expect(errorsFor({ line1: 'a'.repeat(121) }).line1).toBeTruthy();
    expect(errorsFor({ city: 'a'.repeat(61) }).city).toBeTruthy();
    expect(errorsFor({ province: 'a'.repeat(61) }).province).toBeTruthy();
  });

  it('takes 4 to 10 digit postal codes and 7 to 15 digit phones', () => {
    expect(errorsFor({ postalCode: '123' }).postalCode).toBeTruthy();
    expect(errorsFor({ postalCode: '1234' }).postalCode).toBeUndefined();
    expect(errorsFor({ postalCode: '12345678901' }).postalCode).toBeTruthy();
    expect(errorsFor({ postalCode: '12a4' }).postalCode).toBeTruthy();
    expect(errorsFor({ phone: '123456' }).phone).toBeTruthy();
    expect(errorsFor({ phone: '1234567' }).phone).toBeUndefined();
    expect(errorsFor({ phone: '1'.repeat(16) }).phone).toBeTruthy();
  });
});

describe('account fields', () => {
  it('validates email and name the way the register form needs', () => {
    expect(emailField.safeParse('  name@example.com ').data).toBe('name@example.com');
    expect(emailField.safeParse('nope').success).toBe(false);
    expect(nameField.safeParse('A').success).toBe(false);
    expect(nameField.safeParse('a'.repeat(51)).success).toBe(false);
    expect(nameField.safeParse(' Bea ').data).toBe('Bea');
  });
});

describe('shipping shown at checkout', () => {
  it('matches what the server charges, including at the free-shipping boundary', () => {
    expect(SHIPPING_FEE_CENTS).toBe(serverShipping.SHIPPING_FEE_CENTS);
    expect(FREE_SHIPPING_MIN_CENTS).toBe(serverShipping.FREE_SHIPPING_MIN_CENTS);
    for (const cents of [1, FREE_SHIPPING_MIN_CENTS - 1, FREE_SHIPPING_MIN_CENTS, FREE_SHIPPING_MIN_CENTS + 1]) {
      expect(shippingFor(cents)).toBe(serverShipping.shippingFor(cents));
    }
  });
});
