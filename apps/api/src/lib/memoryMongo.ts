// Created by Haihs on 11/11/2026
// Dev/E2E-only in-memory MongoDB fallback for connectDb (decision D16); never used in production.
import mongoose, { type ConnectOptions } from 'mongoose';
import type { Env } from './env';

export interface MemoryServer {
  uri: string;
  stop(): Promise<void>;
}

// Object (not a bare function) so tests can spy on the loader.
export const memoryMongo = {
  async start(): Promise<MemoryServer> {
    // Dynamic import: production paths and `next build` never load the package.
    const mod = await import('mongodb-memory-server').catch(() => {
      throw new Error(
        'In-memory MongoDB requires the "mongodb-memory-server" package (install it or set MONGODB_URI)',
      );
    });
    const server = await mod.MongoMemoryServer.create({ instance: { dbName: 'doc_to_exam_db' } });
    return { uri: server.getUri(), stop: async () => void (await server.stop()) };
  },
};

async function connectInMemory(options: ConnectOptions): Promise<typeof mongoose> {
  const server = await memoryMongo.start().catch((e: unknown) => {
    // fixed text (db.ts replaces the thrown error): no URI, credentials or driver message
    console.error(
      'In-memory MongoDB could not start (dev/test only): set MONGODB_URI or check the mongodb-memory-server install/binary download',
    );
    throw e;
  });
  // Orphan protection is mongodb-memory-server's own mongo_killer process (watches this pid);
  // here we only stop mongod promptly when the connection closes.
  try {
    const m = await mongoose.connect(server.uri, options);
    m.connection.once('close', () => void server.stop().catch(() => undefined));
    // fixed text: no URI, credentials or driver error
    console.warn(
      'Using an in-memory MongoDB (dev/test only): all data is lost when the server stops.',
    );
    return m;
  } catch (e) {
    await server.stop().catch(() => undefined);
    throw e;
  }
}

// Port of source db.js:36-86: configured URI first, in-memory only when allowed (dev/test).
export async function connectWithFallback(
  env: Env,
  options: ConnectOptions,
): Promise<typeof mongoose> {
  if (env.allowInMemoryDb && !env.hasMongoUri) return connectInMemory(options);
  try {
    return await mongoose.connect(env.mongodbUri, options);
  } catch (e) {
    if (!env.allowInMemoryDb) throw e;
    return connectInMemory(options);
  }
}
