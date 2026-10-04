import 'dotenv/config';

// Loaded before anything else (see server.js). Safety nets for hosting, so a missed setting on the
// host fails loudly at start-up instead of quietly running insecure:
// - On Render, run in production mode even if NODE_ENV wasn't set (Secure cookies, no dev secret).
// - In production, refuse to start without a real JWT secret, a database, or the client's address;
//   without MONGODB_URI the server would fall back to the in-memory database and lose everything.
if (process.env.RENDER && !process.env.NODE_ENV) process.env.NODE_ENV = 'production';

if (process.env.NODE_ENV === 'production') {
  const missing = ['JWT_SECRET', 'MONGODB_URI', 'CLIENT_URL'].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Set ${missing.join(', ')} on the host before starting in production.`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('change-me')) {
    console.error('JWT_SECRET must be a random string of at least 32 characters.');
    process.exit(1);
  }
  // Not fatal: the shop works without email, but "forgot password" can't send anything.
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) {
    console.warn('BREVO_API_KEY or MAIL_FROM is missing, so password reset emails will not be sent.');
  }
  // Also not fatal, but without Cloudinary uploads go to local disk, which Render wipes on every deploy.
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn('Cloudinary is not configured, so uploaded images will be lost when the host restarts.');
  }
}
