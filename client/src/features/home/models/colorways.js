// Neon keycap-style colourways. Picked from the product id so a product always renders the same way:
// in the carousel, on its product page, and in its rendered photos.
const COLORWAYS = [
  { name: 'ghost', body: '#17151f', keys: '#24212f', accent: '#00f0ff', trim: '#0c0b12' },
  { name: 'synth', body: '#1d1233', keys: '#2c1d4a', accent: '#ff2bd6', trim: '#110a1f' },
  { name: 'chrome', body: '#c3c9d9', keys: '#e6e9f2', accent: '#00c8dc', trim: '#8a90a6' },
  { name: 'redline', body: '#1c0e12', keys: '#2d161b', accent: '#ff3b5c', trim: '#0f0709' },
  { name: 'ice', body: '#e4f3f9', keys: '#c7ebf5', accent: '#7a5cff', trim: '#a4c2cd' },
  { name: 'volt', body: '#111613', keys: '#1d2420', accent: '#fcee0a', trim: '#080b09' },
];

// Hand-picked exceptions where the hashed colourway doesn't suit the model (a pale pad washes out on the dark theme).
const OVERRIDES = {
  b20000000000000000000015: 'ghost', // Glide Cloth XL
};

export function colorwayFor(id = '') {
  const picked = OVERRIDES[String(id)];
  if (picked) return COLORWAYS.find((c) => c.name === picked);
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORWAYS[hash % COLORWAYS.length];
}
