// Created by Haihs on 11/11/2026
// Tests for teacher/student register + login routes (real in-memory MongoDB, real bcrypt at cost 4).
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as teacherLogin } from '../app/api/auth/teacher/login/route';
import { POST as teacherRegister } from '../app/api/auth/teacher/register/route';
import { POST as studentLogin } from '../app/api/auth/student/login/route';
import { POST as studentRegister } from '../app/api/auth/student/register/route';
import { ok } from '../src/lib/apiResponse';
import { withAuth } from '../src/lib/auth';
import { connectDb } from '../src/lib/db';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { HttpError, withErrors } from '../src/lib/handler';
import { verifyToken } from '../src/lib/jwt';
import { LIMITERS } from '../src/lib/limiters';
import { normalizePhone } from '../src/lib/phone';
import { resetRateLimiters } from '../src/lib/rateLimit';
import { UserModel } from '../src/models/User';
import { validateRegister } from '../src/lib/authValidation';
import { call, startTestDb } from './helpers';

// Controllable wrappers around the real password functions (spies + forced SERVER_BUSY).
const pw = vi.hoisted(() => ({ busy: false }));
vi.mock('../src/lib/passwordHash', async (orig) => {
  const real = await orig<typeof import('../src/lib/passwordHash')>();
  const gate = <A extends unknown[], R>(f: (...a: A) => R) =>
    vi.fn((...a: A): R => {
      if (pw.busy) throw new HttpError('SERVER_BUSY', 'Máy chủ đang bận.');
      return f(...a);
    });
  return {
    ...real,
    hashPassword: gate(real.hashPassword),
    comparePassword: gate(real.comparePassword),
    compareDummy: gate(real.compareDummy),
  };
});
import * as passwordHash from '../src/lib/passwordHash';

const TEACHER_KEY = 'teacher-secret-key-1';
let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  vi.stubEnv('BCRYPT_COST', '4');
  vi.stubEnv('TEACHER_SECRET_KEY', TEACHER_KEY);
  db = await startTestDb();
  vi.stubEnv('MONGODB_URI', db.uri);
  await connectDb();
  await ensureIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
  pw.busy = false;
  resetRateLimiters();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

const post = (
  h: (r: Request) => Promise<Response>,
  body: unknown,
  headers?: Record<string, string>,
) => call(h, { method: 'POST', url: 'http://localhost/api/auth/x', body, headers });
const reg = (over: Record<string, unknown> = {}) => ({
  phoneNumber: '0912345678',
  fullName: 'Nguyễn Văn Ánh',
  password: 'matkhau-1234',
  ...over,
});
const tReg = (over: Record<string, unknown> = {}) => reg({ secretKey: TEACHER_KEY, ...over });
const SECRETS = ['password', 'geminiApiKey', 'tokenVersion', 'nameSearch'];
const noSecrets = (b: unknown) => {
  const s = JSON.stringify(b);
  for (const k of SECRETS) expect(s).not.toContain(`"${k}"`);
};

describe('normalizePhone (shared)', () => {
  it('trims, strips separators, rejects non-strings and long input', () => {
    expect(normalizePhone(' 0912 345.678-9 ')).toBe('09123456789');
    expect(normalizePhone(123)).toBe('');
    expect(normalizePhone('0'.repeat(33))).toBe('');
  });
  it('limiter keys and registration agree on the normalised phone', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: '0912 345 678' }),
    });
    expect(await LIMITERS.LOGIN_PHONE_GLOBAL.key(req)).toBe('p:0912345678');
    const r = await post(studentRegister, reg({ phoneNumber: '0912 345 678' }));
    expect(r.status).toBe(201);
    expect(r.body.data.user.phoneNumber).toBe('0912345678');
    expect((await UserModel.collection.findOne({}))?.phoneNumber).toBe('0912345678');
  });
});

describe('register success', () => {
  it('student: 201, token verifies and works with withAuth, no secrets', async () => {
    const r = await post(studentRegister, reg());
    expect(r.status).toBe(201);
    expect(r.body.success).toBe(true);
    expect(r.body.data.user).toMatchObject({
      role: 'student',
      fullName: 'Nguyễn Văn Ánh',
      mustChangePassword: false,
    });
    noSecrets(r.body);
    const { id } = verifyToken(r.body.data.token);
    expect(id).toBe(r.body.data.user.id);
    const me = await call(withErrors(withAuth(async (_q, ctx) => ok({ id: ctx.userId }))), {
      headers: { authorization: `Bearer ${r.body.data.token}` },
    });
    expect(me.body.data.id).toBe(id);
  });
  it('teacher: 201 with role teacher', async () => {
    const r = await post(teacherRegister, tReg());
    expect(r.status).toBe(201);
    expect(r.body.data.user.role).toBe('teacher');
    noSecrets(r.body);
    expect(verifyToken(r.body.data.token).id).toBe(r.body.data.user.id);
  });
  it('teacher geminiApiKey is stored encrypted and absent from the response', async () => {
    const r = await post(teacherRegister, tReg({ geminiApiKey: 'AIza-plain-key-1234' }));
    expect(r.status).toBe(201);
    expect(JSON.stringify(r.body)).not.toContain('AIza-plain-key-1234');
    expect(r.body.data.user).toMatchObject({ hasApiKey: true, apiKeyLast4: '1234' });
    const raw = await UserModel.collection.findOne({});
    expect(String(raw?.geminiApiKey)).toMatch(/^enc:v1:/);
    expect(JSON.stringify(raw)).not.toContain('AIza-plain-key-1234');
  });
  it('student ignores secretKey and geminiApiKey', async () => {
    const r = await post(
      studentRegister,
      reg({ secretKey: TEACHER_KEY, geminiApiKey: 'AIza-x-1234567' }),
    );
    expect(r.status).toBe(201);
    expect(r.body.data.user.hasApiKey).toBeUndefined();
    expect((await UserModel.collection.findOne({}))?.geminiApiKey).toBe('');
  });
  it('mass assignment: role/tokenVersion/mustChangePassword from the body are ignored', async () => {
    const r = await post(
      studentRegister,
      reg({ role: 'teacher', tokenVersion: 9, mustChangePassword: true, extra: 1 }),
    );
    expect(r.status).toBe(201);
    const raw = await UserModel.collection.findOne({});
    expect(raw).toMatchObject({ role: 'student', tokenVersion: 0, mustChangePassword: false });
    const t = await post(teacherRegister, tReg({ phoneNumber: '0912345679', role: 'admin' }));
    expect(t.body.data.user.role).toBe('teacher');
  });
});

describe('register validation (400 with field, before DB/bcrypt)', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['bad phone prefix', { phoneNumber: '+84912345678' }, 'phoneNumber'],
    ['short phone', { phoneNumber: '091234567' }, 'phoneNumber'],
    ['letters in phone', { phoneNumber: '09123abc78' }, 'phoneNumber'],
    ['non-string phone', { phoneNumber: 912345678 }, 'phoneNumber'],
    ['1-char name', { fullName: 'A' }, 'fullName'],
    ['numeric name', { fullName: 'Nguyen 123' }, 'fullName'],
    ['non-string name', { fullName: ['a', 'b'] }, 'fullName'],
    ['7-char password', { password: '1234567' }, 'password'],
    ['73-byte password', { password: 'a'.repeat(73) }, 'password'],
    ['missing password', { password: undefined }, 'password'],
  ];
  it.each(cases)('%s', async (_n, over, field) => {
    const r = await post(studentRegister, reg(over));
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ success: false, code: 'VALIDATION', field });
    expect(passwordHash.hashPassword).not.toHaveBeenCalled();
    expect(await UserModel.countDocuments()).toBe(0);
  });
  it.each([[[]], [null], ['x'], [5]])('non-object body %j -> 400', async (b) => {
    const r = await post(studentRegister, b);
    expect(r).toMatchObject({ status: 400, body: { code: 'VALIDATION' } });
  });
  it('malformed JSON -> 400, body > 1MiB -> 413', async () => {
    const bad = await studentRegister(
      new Request('http://localhost/', { method: 'POST', body: '{bad' }),
    );
    expect(bad.status).toBe(400);
    const big = await post(studentRegister, reg({ fullName: 'a'.repeat(1_100_000) }));
    expect(big.status).toBe(413);
  });
  it('honeypot website -> generic 400 for both audiences, no user', async () => {
    for (const [h, b] of [
      [studentRegister, reg({ website: 'http://spam' })],
      [teacherRegister, tReg({ website: 'http://spam' })],
    ] as const) {
      const r = await post(h, b);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION');
      expect(r.body.field).toBeUndefined();
      expect(r.body.message).not.toMatch(/website|honeypot|bot/i);
    }
    expect(await UserModel.countDocuments()).toBe(0);
  });
  it('validateRegister returns only the whitelisted fields', () => {
    expect(
      validateRegister({ ...reg({ phoneNumber: '0912 345 678' }), role: 'admin', x: 1 }, 'student'),
    ).toEqual({
      phoneNumber: '0912345678',
      fullName: 'Nguyễn Văn Ánh',
      password: 'matkhau-1234',
    });
  });
});

describe('teacher secret key', () => {
  it.each([[{ secretKey: 'wrong-key-123456' }], [{ secretKey: undefined }], [{ secretKey: 123 }]])(
    'wrong/missing %j -> 403, no user, no hashing',
    async (over) => {
      const r = await post(teacherRegister, reg(over));
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('SECRET_KEY_INVALID');
      expect(await UserModel.countDocuments()).toBe(0);
      expect(passwordHash.hashPassword).not.toHaveBeenCalled();
    },
  );
});

describe('duplicate phone', () => {
  it('second register -> 409 PHONE_TAKEN (also across roles, normalised form)', async () => {
    expect((await post(studentRegister, reg())).status).toBe(201);
    const r = await post(teacherRegister, tReg({ phoneNumber: '0912.345.678' }));
    expect(r).toMatchObject({ status: 409, body: { code: 'PHONE_TAKEN' } });
    expect(await UserModel.countDocuments()).toBe(1);
  });
  it('two concurrent registrations: exactly one 201 and one 409', async () => {
    const rs = await Promise.all([post(studentRegister, reg()), post(studentRegister, reg())]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await UserModel.countDocuments()).toBe(1);
  });
  it('failure after hashing (DB error) -> 500 without detail and no user', async () => {
    vi.spyOn(UserModel.prototype, 'save').mockRejectedValueOnce(
      new Error('mongodb://secret-host exploded'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post(studentRegister, reg());
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toMatch(/secret-host|exploded|stack/);
    expect(await UserModel.countDocuments()).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('login', () => {
  beforeEach(async () => {
    await post(studentRegister, reg());
    await post(teacherRegister, tReg({ phoneNumber: '0987654321' }));
  });
  it('correct credentials -> 200 with token, user, no secrets (phone separators accepted)', async () => {
    const r = await post(studentLogin, { phoneNumber: '0912 345 678', password: 'matkhau-1234' });
    expect(r.status).toBe(200);
    expect(verifyToken(r.body.data.token).id).toBe(r.body.data.user.id);
    expect(r.body.data.user.role).toBe('student');
    noSecrets(r.body);
    expect(
      (await post(teacherLogin, { phoneNumber: '0987654321', password: 'matkhau-1234' })).status,
    ).toBe(200);
  });
  it('wrong password, unknown phone, cross-role: identical 401 bodies', async () => {
    const wrong = await post(studentLogin, { phoneNumber: '0912345678', password: 'nope-nope-1' });
    const unknown = await post(studentLogin, {
      phoneNumber: '0900000000',
      password: 'nope-nope-1',
    });
    const crossS = await post(teacherLogin, {
      phoneNumber: '0912345678',
      password: 'matkhau-1234',
    });
    const crossT = await post(studentLogin, {
      phoneNumber: '0987654321',
      password: 'matkhau-1234',
    });
    for (const r of [wrong, unknown, crossS, crossT]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual(wrong.body);
    }
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });
  it('unknown phone runs compareDummy; known user (even cross-role) runs a real compare', async () => {
    await post(studentLogin, { phoneNumber: '0900000000', password: 'x-y-z-1234' });
    expect(passwordHash.compareDummy).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    await post(teacherLogin, { phoneNumber: '0912345678', password: 'matkhau-1234' });
    expect(passwordHash.compareDummy).not.toHaveBeenCalled();
    expect(passwordHash.comparePassword).toHaveBeenCalledTimes(1);
  });
  it('invalid phone format -> 400 VALIDATION before any bcrypt', async () => {
    vi.clearAllMocks();
    const r = await post(studentLogin, { phoneNumber: '12345', password: 'abcdefgh' });
    expect(r).toMatchObject({ status: 400, body: { code: 'VALIDATION', field: 'phoneNumber' } });
    expect(passwordHash.comparePassword).not.toHaveBeenCalled();
    expect(passwordHash.compareDummy).not.toHaveBeenCalled();
  });
  it.each([[''], [undefined], [12345678]])(
    'empty/non-string password %j -> 400',
    async (password) => {
      const r = await post(studentLogin, { phoneNumber: '0912345678', password });
      expect(r.status).toBe(400);
    },
  );
  it('password > 1024 chars -> same 401, no bcrypt', async () => {
    vi.clearAllMocks();
    const base = await post(studentLogin, { phoneNumber: '0912345678', password: 'nope-nope-1' });
    vi.clearAllMocks();
    const r = await post(studentLogin, { phoneNumber: '0912345678', password: 'a'.repeat(1025) });
    expect(r).toMatchObject({ status: 401, body: base.body });
    expect(passwordHash.comparePassword).not.toHaveBeenCalled();
    expect(passwordHash.compareDummy).not.toHaveBeenCalled();
  });
});

describe('SERVER_BUSY and rate limit', () => {
  it('hash gate busy -> 503 with Retry-After on register; no user', async () => {
    pw.busy = true;
    const res = await studentRegister(
      new Request('http://localhost/', { method: 'POST', body: JSON.stringify(reg()) }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect((await res.json()).code).toBe('SERVER_BUSY');
    expect(await UserModel.countDocuments()).toBe(0);
  });
  it('compare gate busy on login -> 503', async () => {
    await post(studentRegister, reg());
    pw.busy = true;
    const r = await post(studentLogin, { phoneNumber: '0912345678', password: 'matkhau-1234' });
    expect(r.status).toBe(503);
  });
  it('11th failed teacher login -> 429 with Retry-After (limiter counts the 401s)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const send = () =>
        teacherLogin(
          new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '0900000000', password: 'wrong-wrong' }),
          }),
        );
      for (let i = 0; i < 10; i++) expect((await send()).status).toBe(401);
      const res = await send();
      expect(res.status).toBe(429);
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    } finally {
      vi.stubEnv('NODE_ENV', 'test');
    }
  });
  it('student login failures are counted per account (LOGIN_ACCOUNT, 10 then 429)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const send = () =>
        studentLogin(
          new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber: '0900000000', password: 'wrong-wrong' }),
          }),
        );
      for (let i = 0; i < 10; i++) expect((await send()).status).toBe(401);
      expect((await send()).status).toBe(429);
    } finally {
      vi.stubEnv('NODE_ENV', 'test');
    }
  });
});
