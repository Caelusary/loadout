import mongoose from 'mongoose';
import '../models/index.js';

let memoryServer;

// Uses MONGODB_URI when set. Otherwise (development and tests) starts a single-node in-memory
// replica set, because checkout and cancellation need multi-document transactions.
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production.');
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    // The default 10s launch timeout is too tight on a busy laptop (cold mongod boots took ~12s), so allow a minute.
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      instanceOpts: [{ launchTimeout: 60_000 }],
    });
    uri = memoryServer.getUri('loadout');
  }
  await mongoose.connect(uri);
  // Unique indexes must exist before any writes rely on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return { inMemory: Boolean(memoryServer) };
}

export async function disconnectDB() {
  await mongoose.disconnect();
  await memoryServer?.stop();
  memoryServer = undefined;
}
