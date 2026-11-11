// Created by Haihs on 11/11/2026
// Password hashing: native bcrypt (fallback bcryptjs) behind a bounded concurrency gate (port of server/utils/passwordHash.js).
import { randomBytes } from 'node:crypto';
import { HttpError } from './handler';

interface Bcrypt {
  hash(plain: string, cost: number): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

// shortcut: bcryptjs fallback blocks the main thread under load, install native bcrypt in prod.
// Native runs in the libuv threadpool (does not block the event loop); fall back to pure JS with one warning.
let bcryptPromise: Promise<Bcrypt> | undefined;
const loadBcrypt = (): Promise<Bcrypt> =>
  (bcryptPromise ??= import('bcrypt')
    .then((m) => (m.default ?? m) as unknown as Bcrypt)
    .catch(async (err: unknown) => {
      console.warn(
        `Cannot load native bcrypt (${(err as Error).message}); using bcryptjs (heavier on the event loop).`,
      );
      const m = await import('bcryptjs');
      return (m.default ?? m) as unknown as Bcrypt;
    }));

const MAX_CONCURRENT = 4; // matches libuv's default threadpool
const MAX_QUEUE = 300; // more than one class (120 people)
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt truncates beyond this: reject instead of silently cutting

const costFrom = (raw: string | undefined, min: number, max: number, fallback: number) => {
  const t = raw?.trim() ?? '';
  const v = /^\d+$/.test(t) ? Number(t) : NaN;
  return v >= min && v <= max ? v : fallback;
};
// Read per call so tests can stub env; invalid values fall back to the default.
export const bcryptCost = (src: Record<string, string | undefined> = process.env) =>
  costFrom(src.BCRYPT_COST, 4, 15, 10);
export const bcryptTempCost = (src: Record<string, string | undefined> = process.env) =>
  costFrom(src.BCRYPT_TEMP_COST, 4, 14, 8);

/** Semaphore: at most `concurrency` running, at most `maxQueue` waiting; beyond that SERVER_BUSY (503). */
export function createGate({ concurrency, maxQueue }: { concurrency: number; maxQueue: number }) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    const next = waiting.shift();
    if (next)
      next(); // hand the slot over: running stays the same
    else running -= 1;
  };
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= concurrency) {
      if (waiting.length >= maxQueue)
        throw new HttpError('SERVER_BUSY', 'Máy chủ đang bận, vui lòng thử lại sau vài giây.');
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      running += 1;
    }
    try {
      return await task();
    } finally {
      release();
    }
  };
}

const gate = createGate({ concurrency: MAX_CONCURRENT, maxQueue: MAX_QUEUE });

const hashWith = (plain: string, cost: number) => {
  // Defensive: callers should run assertPasswordPolicy; never let bcrypt silently truncate.
  if (typeof plain !== 'string' || Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new HttpError('VALIDATION', 'Mật khẩu không hợp lệ.', { field: 'password' });
  }
  return gate(async () => (await loadBcrypt()).hash(plain, cost));
};
export const hashPassword = async (plain: string) => hashWith(plain, bcryptCost());
export const hashTempPassword = async (plain: string) => hashWith(plain, bcryptTempCost());
// Login path: must NOT throw for long or non-string passwords (returns false); bcrypt compare truncates safely.
export const comparePassword = async (plain: string, hash: string): Promise<boolean> =>
  typeof plain !== 'string' ? false : gate(async () => (await loadBcrypt()).compare(plain, hash));

// Dummy hash so the "no such user" path costs about the same as a real compare (same cost, same gate).
// Failures are not cached: a cached rejection would make unknown accounts fail forever, an account oracle.
// shortcut: dummy hash is built lazily on first call, so the first unknown-user login is slower; precompute at boot if it matters.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () =>
  (dummyHash ??= hashPassword(randomBytes(16).toString('hex')).catch((err: unknown) => {
    dummyHash = undefined;
    throw err;
  }));
export const resetDummyHash = () => {
  dummyHash = undefined;
};
// Never throws for long/non-string input (non-string runs the compare with '').
export async function compareDummy(plain: string): Promise<void> {
  await comparePassword(typeof plain === 'string' ? plain : '', await getDummyHash());
}

/** Throws VALIDATION unless the NEW password is >= 8 code points and <= 72 UTF-8 bytes. */
export function assertPasswordPolicy(plain: string): void {
  if (typeof plain !== 'string' || [...plain].length < MIN_PASSWORD_LENGTH) {
    throw new HttpError('VALIDATION', `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`, {
      field: 'password',
    });
  }
  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new HttpError(
      'VALIDATION',
      `Mật khẩu quá dài (tối đa ${MAX_PASSWORD_BYTES} byte, ký tự có dấu chiếm nhiều byte hơn).`,
      {
        field: 'password',
      },
    );
  }
}
