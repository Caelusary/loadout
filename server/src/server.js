import './env.js'; // first: loads .env and checks production settings
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seed } from './seed/seed.js';
import { purgeExpired } from './features/activity/service.js';
import { autoCompleteShipped } from './features/orders/service.js';

const { inMemory } = await connectDB();
if (inMemory) {
  await seed();
  console.log('Using a seeded in-memory MongoDB. Data resets when the server stops.');
}

// PORT belongs to the host (Render sets it). Locally the API stays on 5000, where the Vite proxy points,
// even if a tool exports PORT for the web dev server.
const hosted = process.env.NODE_ENV === 'production' || process.env.RENDER;
const port = Number(hosted ? process.env.PORT : process.env.API_PORT) || 5000;
const server = createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));

// Housekeeping that would otherwise need a cron job: shipped orders nobody confirmed complete after
// 7 days, and deleted accounts past their 30-day restore window lose their saved copy. Runs now (a
// sleeping free host wakes here) and hourly; both steps are safe to repeat.
const housekeeping = () =>
  Promise.all([autoCompleteShipped(), purgeExpired()]).catch((err) => console.error('Housekeeping failed:', err.message));
housekeeping();
setInterval(housekeeping, 60 * 60 * 1000).unref();

// Render sends SIGTERM on every deploy and restart (node --watch does too). Stop taking connections,
// let in-flight requests finish, then close MongoDB (and stop the in-memory one so no mongod is left
// behind). Exit anyway after 10 seconds so a stuck keep-alive socket can't hold up the deploy.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down.`);
  setTimeout(() => process.exit(1), 10_000).unref();
  server.closeIdleConnections();
  await new Promise((resolve) => server.close(resolve));
  await disconnectDB().catch((err) => console.error('Closing MongoDB failed:', err.message));
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
