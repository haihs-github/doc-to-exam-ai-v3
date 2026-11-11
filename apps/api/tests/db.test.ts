// Created by Haihs on 11/11/2026
// Tests for connectDb: globalThis singleton and non-leaking connection errors.
import mongoose from 'mongoose';
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { connectDb } from '../src/lib/db';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb();
});
afterAll(async () => {
  await db.stop();
});
afterEach(async () => {
  await mongoose.disconnect();
  delete (globalThis as Record<string, unknown>).__docToExamMongoose;
  delete process.env.MONGODB_URI;
});

describe('connectDb', () => {
  it('returns the same instance twice and does not grow connections', async () => {
    process.env.MONGODB_URI = db.uri;
    const a = await connectDb();
    const n = mongoose.connections.length;
    const b = await connectDb();
    expect(b).toBe(a);
    expect(mongoose.connections.length).toBe(n);
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('rejects an unreachable URI with a clear error that leaks no credentials', async () => {
    process.env.MONGODB_URI = 'mongodb://user:pass@127.0.0.1:1/db';
    const err = await connectDb({ serverSelectionTimeoutMS: 300 }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/MongoDB/);
    expect(msg).not.toContain('user');
    expect(msg).not.toContain('pass');
    // a failed attempt must not be cached
    process.env.MONGODB_URI = db.uri;
    await expect(connectDb()).resolves.toBe(mongoose);
  });
});
