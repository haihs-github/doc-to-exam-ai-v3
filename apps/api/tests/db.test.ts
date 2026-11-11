// Created by Haihs on 11/11/2026
// Tests for connectDb: globalThis singleton and non-leaking connection errors.
import mongoose from 'mongoose';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).__docToExamMongoose; // resets the cache between tests only
  delete process.env.MONGODB_URI;
  vi.unstubAllEnvs();
});

// the property is read-only in the typings but has a setter that emits the state events
const setReadyState = (n: number) => ((mongoose.connection as { readyState: number }).readyState = n);

describe('connectDb', () => {
  it('returns the same instance twice and does not grow connections', async () => {
    process.env.MONGODB_URI = db.uri;
    const a = await connectDb();
    const b = await connectDb();
    expect(b).toBe(a);
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
    expect(msg).not.toContain('127.0.0.1');
    expect(msg).not.toContain('mongodb://');
    // a failed attempt must not be cached
    process.env.MONGODB_URI = db.uri;
    await expect(connectDb()).resolves.toBe(mongoose);
  });

  it('reconnects after disconnect instead of returning a dead cached connection', async () => {
    process.env.MONGODB_URI = db.uri;
    await connectDb();
    await mongoose.disconnect();
    expect(mongoose.connection.readyState).toBe(0);
    await connectDb();
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('a transient disconnect without close does not trigger a second connect (no MongoClient leak)', async () => {
    process.env.MONGODB_URI = db.uri;
    await connectDb();
    const spy = vi.spyOn(mongoose, 'connect');
    setReadyState(0); // driver auto-reconnect: state flips to disconnected, no 'close' event
    await expect(connectDb()).resolves.toBe(mongoose);
    expect(spy).not.toHaveBeenCalled();
    setReadyState(1);
  });

  it('concurrent calls share one connect and one instance', async () => {
    process.env.MONGODB_URI = db.uri;
    const spy = vi.spyOn(mongoose, 'connect');
    const [a, b] = await Promise.all([connectDb(), connectDb()]);
    expect(a).toBe(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rejects (does not throw synchronously) when production env is invalid', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', '');
    let p: Promise<unknown> | undefined;
    expect(() => { p = connectDb(); }).not.toThrow();
    await expect(p).rejects.toThrow(/JWT_SECRET/);
  });
});
