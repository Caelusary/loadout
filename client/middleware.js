import { ipAddress, next } from '@vercel/functions';

// Vercel routing middleware: runs before the /api rewrite in vercel.json sends a request to Render.
// It stamps the request with PROXY_SECRET (set in the Vercel project) so the API knows it came
// through the site, and with the visitor's IP, which Vercel knows and a browser can't fake. Both
// headers are overwritten, so a value a visitor sends in them is discarded. See server/src/middleware/proxy.js.
export const config = { matcher: '/api/:path*' };

export default function middleware(request) {
  const headers = new Headers(request.headers);
  headers.set('x-proxy-secret', process.env.PROXY_SECRET ?? '');
  const ip = ipAddress(request);
  if (ip) headers.set('x-client-ip', ip);
  else headers.delete('x-client-ip');
  return next({ request: { headers } });
}