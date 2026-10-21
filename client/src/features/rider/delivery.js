// Shared by the run sheet and the order page, so a rider gets the same links and the same rules on both.

export const shortDay = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });

// A search link opens the address in the phone's maps app (or Google Maps in a browser).
export const mapsLink = (to) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${to.line1}, ${to.city}, ${to.province} ${to.postalCode}`)}`;

// The buyer is away and picked a later day for the next try.
export const retryLater = (o) => Boolean(o.retryOn) && new Date(o.retryOn) > new Date();

// A buyer said a delivered order never came, and the rider hasn't given their side yet.
export const needsReply = (o) => o.deliveryIssue?.status === 'open' && !o.deliveryIssue?.riderReply;
