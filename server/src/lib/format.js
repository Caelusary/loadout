// The short order number people see and say: the last six characters of its id, like #1FCDA9. The client's
// lib/format.js has the same one.
export const orderNumber = (id) => `#${String(id).slice(-6).toUpperCase()}`;
