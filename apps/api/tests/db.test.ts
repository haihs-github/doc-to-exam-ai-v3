// Created by Haihs on 11/11/2026
// Tests for connectDb: globalThis singleton and non-leaking connection errors.
import mongoose from 'mongoose';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { connectDb } from '../src/lib/db';
import { memoryMongo } from '../src/lib/memoryMongo';
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
    vi.stubEnv('ALLOW_IN_MEMORY_DB', 'false'); // Haihs: M1-T3 test env cho phép fallback in-memory, tắt để kiểm đường lỗi - start - end
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

// Haihs: M1-T3 test fallback MongoDB in-memory (D16) - start
describe('connectDb in-memory fallback', () => {
  const stubServer = () => {
    const stop = vi.fn(async () => undefined);
    const start = vi.spyOn(memoryMongo, 'start').mockImplementation(async () => ({ uri: db.uri, stop }));
    return { start, stop };
  };
  const warnText = (w: ReturnType<typeof vi.spyOn>) => w.mock.calls.flat().join(' ');

  it('dev + no URI connects via in-memory and warns once without URI text', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { start } = stubServer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await connectDb();
    expect(mongoose.connection.readyState).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warnText(warn)).not.toMatch(/mongodb:\/\/|127\.0\.0\.1/);
  });

  it('dev + unreachable URI falls back; warn leaks no credentials/host', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    process.env.MONGODB_URI = 'mongodb://user:pass@127.0.0.1:1/db';
    const { start } = stubServer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await connectDb({ serverSelectionTimeoutMS: 300 });
    expect(mongoose.connection.readyState).toBe(1);
    expect(start).toHaveBeenCalledTimes(1);
    const t = warnText(warn);
    for (const bad of ['user', 'pass', '127.0.0.1', 'mongodb://']) expect(t).not.toContain(bad);
  });

  it('production + no URI rejects naming the variable and never starts in-memory', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'x'.repeat(20));
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'x'.repeat(20));
    vi.stubEnv('TEACHER_SECRET_KEY', 'x'.repeat(10));
    const { start } = stubServer();
    await expect(connectDb()).rejects.toThrow(/MONGODB_URI/);
    expect(start).not.toHaveBeenCalled();
  });

  it.each(['production', 'staging'])('%s + unreachable URI rejects with a fixed message, no fallback', async (env) => {
    vi.stubEnv('NODE_ENV', env);
    vi.stubEnv('JWT_SECRET', 'x'.repeat(20));
    vi.stubEnv('API_KEY_ENCRYPTION_SECRET', 'x'.repeat(20));
    vi.stubEnv('TEACHER_SECRET_KEY', 'x'.repeat(10));
    process.env.MONGODB_URI = 'mongodb://user:pass@127.0.0.1:1/db';
    const { start } = stubServer();
    const err = await connectDb({ serverSelectionTimeoutMS: 300 }).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/Cannot connect to MongoDB/);
    expect((err as Error).message).not.toContain('pass');
    expect(start).not.toHaveBeenCalled();
  });

  it('stops the memory server on disconnect and starts a fresh one next time', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { start, stop } = stubServer();
    await connectDb();
    await mongoose.disconnect();
    expect(stop).toHaveBeenCalledTimes(1);
    await connectDb();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('concurrent calls start ONE memory server', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { start } = stubServer();
    await Promise.all([connectDb(), connectDb(), connectDb()]);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('real mongod: dev + no URI works end to end and the server is stopped on close', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const real = vi.spyOn(memoryMongo, 'start');
    await connectDb();
    expect(mongoose.connection.readyState).toBe(1);
    const res = await mongoose.connection.db!.collection('t').insertOne({ a: 1 });
    expect(res.acknowledged).toBe(true);
    const server = await real.mock.results[0]!.value;
    const stop = vi.spyOn(server, 'stop');
    await mongoose.disconnect();
    await vi.waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  }, 60000);
});
// Haihs: M1-T3 test fallback MongoDB in-memory (D16) - end
