// Mirrored in client/src/lib/constants.js for display only; the server value is what gets charged.
export const SHIPPING_FEE_CENTS = 15000;
export const FREE_SHIPPING_MIN_CENTS = 300000;

export const shippingFor = (subtotalCents) => (subtotalCents >= FREE_SHIPPING_MIN_CENTS ? 0 : SHIPPING_FEE_CENTS);
