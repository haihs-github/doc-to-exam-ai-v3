// Created by Haihs on 11/11/2026
// Tests for passwordHash: policy, bcrypt hash/compare, dummy-compare timing, concurrency gate.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/lib/handler';
import {
  assertPasswordPolicy,
  bcryptCost,
  bcryptTempCost,
  compareDummy,
  comparePassword,
  createGate,
  hashPassword,
  hashTempPassword,
  resetDummyHash,
} from '../src/lib/passwordHash';

beforeEach(() => {
  vi.stubEnv('BCRYPT_COST', '4');
  vi.stubEnv('BCRYPT_TEMP_COST', '4');
  resetDummyHash();
});

const policyError = (p: unknown) => {
  try {
    assertPasswordPolicy(p as string);
  } catch (e) {
    return e as HttpError;
  }
  return null;
};

describe('assertPasswordPolicy', () => {
  it('accepts 72 bytes, rejects 73 (multi-byte)', () => {
    expect(policyError('a'.repeat(72))).toBeNull();
    expect(policyError('a'.repeat(73))?.code).toBe('VALIDATION');
    expect(policyError('ệ'.repeat(24))).toBeNull(); // 24 x 3 bytes = 72
    const e = policyError('ệ'.repeat(24) + 'a');
    expect(e?.code).toBe('VALIDATION');
    expect(e?.extra).toEqual({ field: 'password' });
  });
  it('counts code points: 7 rejected, 8 emoji accepted', () => {
    expect(policyError('1234567')?.code).toBe('VALIDATION');
    expect(policyError('😀'.repeat(7))?.code).toBe('VALIDATION');
    expect(policyError('😀'.repeat(8))).toBeNull(); // 32 bytes
  });
  it('rejects non-strings', () => {
    expect(policyError(12345678)?.code).toBe('VALIDATION');
    expect(policyError(undefined)?.code).toBe('VALIDATION');
  });
});

describe('hash / compare', () => {
  it('hashes and verifies, uses env cost', async () => {
    const h = await hashPassword('correct horse');
    expect(h).toMatch(/^\$2[aby]\$04\$/);
    expect(await comparePassword('correct horse', h)).toBe(true);
    expect(await comparePassword('wrong horse', h)).toBe(false);
  });
  it('hashTempPassword uses BCRYPT_TEMP_COST', async () => {
    vi.stubEnv('BCRYPT_TEMP_COST', '5');
    expect(await hashTempPassword('abcdefgh')).toMatch(/^\$2[aby]\$05\$/);
  });
  it('cost parsing: strict integers, boundaries', () => {
    for (const bad of ['0x0a', '1e1', '10.5', '', ' ', '-5', 'abc'])
      expect(bcryptCost({ BCRYPT_COST: bad })).toBe(10);
    expect([3, 4, 15, 16].map((n) => bcryptCost({ BCRYPT_COST: String(n) }))).toEqual([
      10, 4, 15, 10,
    ]);
    expect([3, 4, 14, 15].map((n) => bcryptTempCost({ BCRYPT_TEMP_COST: String(n) }))).toEqual([
      8, 4, 14, 8,
    ]);
    expect(bcryptTempCost({})).toBe(8);
  });
  it('hash rejects >72 bytes / non-string; compare never throws for them', async () => {
    await expect(hashPassword('a'.repeat(73))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(hashTempPassword(5 as unknown as string)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const h = await hashPassword('abcdefgh');
    expect(await comparePassword('x'.repeat(500), h)).toBe(false);
    expect(await comparePassword(undefined as unknown as string, h)).toBe(false);
    await expect(compareDummy(undefined as unknown as string)).resolves.toBeUndefined();
  });
  it('invalid cost falls back to default', async () => {
    vi.stubEnv('BCRYPT_COST', '99');
    expect(await hashPassword('abcdefgh')).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe('compareDummy', () => {
  it('takes the same order of time as a real failed compare', async () => {
    vi.stubEnv('BCRYPT_COST', '8');
    const real = await hashPassword('some-password');
    const median = async (fn: () => Promise<unknown>) => {
      const t: number[] = [];
      for (let i = 0; i < 5; i++) {
        const s = performance.now();
        await fn();
        t.push(performance.now() - s);
      }
      return t.sort((a, b) => a - b)[2]!;
    };
    await compareDummy('warm-up'); // builds the cached dummy hash outside the timing
    const tReal = await median(() => comparePassword('nope-nope', real));
    const tDummy = await median(() => compareDummy('nope-nope'));
    const ratio = tDummy / tReal;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });
  it('resolves to undefined', async () => {
    expect(await compareDummy('whatever')).toBeUndefined();
  });
});

describe('createGate', () => {
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const p = new Promise<string>((res, rej) => {
      resolve = () => res('ok');
      reject = rej;
    });
    return { p, resolve, reject };
  };

  it('N+Q+1 tasks: exactly one SERVER_BUSY, the rest resolve', async () => {
    const gate = createGate({ concurrency: 2, maxQueue: 3 });
    const ds = Array.from({ length: 6 }, deferred);
    const results = ds.map((d) =>
      gate(() => d.p).then(
        (v) => v,
        (e: unknown) => e,
      ),
    );
    await new Promise((r) => setTimeout(r, 10));
    ds.forEach((d) => d.resolve());
    const out = await Promise.all(results);
    const busy = out.filter((o) => o instanceof HttpError);
    expect(busy).toHaveLength(1);
    expect((busy[0] as HttpError).code).toBe('SERVER_BUSY');
    expect(out.filter((o) => o === 'ok')).toHaveLength(5);
  });

  it('never exceeds N concurrent and serves the queue FIFO', async () => {
    const gate = createGate({ concurrency: 2, maxQueue: 10 });
    let active = 0;
    let max = 0;
    const started: number[] = [];
    const tasks = Array.from({ length: 6 }, (_, i) =>
      gate(async () => {
        started.push(i);
        active += 1;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      }),
    );
    await Promise.all(tasks);
    expect(max).toBe(2);
    expect(started).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('releases slots when a task fails (no deadlock)', async () => {
    const gate = createGate({ concurrency: 1, maxQueue: 1 });
    const bad = gate(() => Promise.reject(new Error('boom')));
    const next = gate(async () => 'after');
    await expect(bad).rejects.toThrow('boom');
    expect(await next).toBe('after');
    expect(await gate(async () => 'again')).toBe('again');
  });

  it('gate state is per instance', async () => {
    const a = createGate({ concurrency: 1, maxQueue: 0 });
    const b = createGate({ concurrency: 1, maxQueue: 0 });
    const d = deferred();
    const held = a(() => d.p);
    await expect(a(async () => 1)).rejects.toMatchObject({ code: 'SERVER_BUSY' });
    expect(await b(async () => 2)).toBe(2);
    d.resolve();
    await held;
  });
});
