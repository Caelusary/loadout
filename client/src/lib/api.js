const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const API_ORIGIN = /^https?:\/\//.test(BASE) ? new URL(BASE).origin : '';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? (status === 0 ? "Can't reach the server. Check your connection." : 'Something went wrong.'));
    this.status = status;
    this.code = body?.error?.code;
    this.fields = body?.error?.fields;
    this.details = body?.error?.details;
  }
}

export async function api(path, { method = 'GET', body, form, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Uploaded files live on the API; rendered product shots live on the client.
export const assetUrl = (url) => (url?.startsWith('/api/') && API_ORIGIN ? `${API_ORIGIN}${url}` : url);

// The smallest stored copy at least `size` pixels wide. Seed photos ship at 800, 400 and 200 px
// (name.webp, name-400.webp, name-200.webp); Cloudinary resizes on request and picks the format.
const SEED_PHOTO = /^(\/products\/[^/?]+?)(?<!-200|-400)\.webp(\?.*)?$/;
export function sizedImageUrl(url, size) {
  if (!url) return url;
  const width = size <= 200 ? 200 : size <= 400 ? 400 : 800;
  const seed = url.match(SEED_PHOTO);
  if (seed) return width === 800 ? url : `${seed[1]}-${width}.webp${seed[2] ?? ''}`;
  if (url.startsWith('https://res.cloudinary.com/') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/c_limit,w_${width},f_auto,q_auto/`);
  }
  return assetUrl(url);
}

// Every stored width as a srcset, so the browser picks by layout width and screen density. Only for
// sources with copies (seed photos and Cloudinary); anything else gets undefined and uses src alone.
export function imageSrcSet(url) {
  if (!url || (!SEED_PHOTO.test(url) && !url.startsWith('https://res.cloudinary.com/'))) return undefined;
  return [200, 400, 800].map((w) => `${sizedImageUrl(url, w)} ${w}w`).join(', ');
}

export const toQuery = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

// Maps server field errors onto a react-hook-form instance. `rename` maps server paths to form names.
export function applyServerErrors(error, setError, rename = {}) {
  if (!(error instanceof ApiError) || !error.fields) return false;
  for (const [path, message] of Object.entries(error.fields)) {
    setError(rename[path] ?? path, { type: 'server', message });
  }
  return true;
}
