// Created by Haihs on 11/11/2026
// Tests for me / api-key / logout-all / change-password routes (real in-memory MongoDB, real bcrypt at cost 4).
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT as apiKey } from '../app/api/auth/api-key/route';
import { POST as changePassword } from '../app/api/auth/change-password/route';
import { POST as logoutAll } from '../app/api/auth/logout-all/route';
import { GET as me } from '../app/api/auth/me/route';
import { POST as studentRegister } from '../app/api/auth/student/register/route';
import { POST as teacherRegister } from '../app/api/auth/teacher/register/route';
import { ok } from '../src/lib/apiResponse';
import { withAuth } from '../src/lib/auth';
import { connectDb } from '../src/lib/db';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { withErrors } from '../src/lib/handler';
import { verifyToken } from '../src/lib/jwt';
import { resetRateLimiters } from '../src/lib/rateLimit';
import { clearRbacCache, seedRbac } from '../src/lib/rbac';
import { UserModel } from '../src/models/User';
import { call, startTestDb } from './helpers';

const TEACHER_KEY = 'teacher-secret-key-1';
const PW = 'password-123';
const URL_ = 'http://localhost/api/auth/x';
const GEMINI = 'AIzaSyFAKE-KEY-0123456789-wxyz';
let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  vi.stubEnv('BCRYPT_COST', '4');
  vi.stubEnv('TEACHER_SECRET_KEY', TEACHER_KEY);
  vi.stubEnv('ENABLE_TEACHER_SECRET', 'true'); // Haihs: mã bí mật chỉ kiểm khi bật cờ - start - end
  db = await startTestDb();
  vi.stubEnv('MONGODB_URI', db.uri);
  await connectDb();
  await ensureIndexes();
  await seedRbac();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await UserModel.deleteMany({});
  clearRbacCache();
  resetRateLimiters();
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  vi.stubEnv('BCRYPT_COST', '4');
  vi.stubEnv('TEACHER_SECRET_KEY', TEACHER_KEY);
  vi.stubEnv('ENABLE_TEACHER_SECRET', 'true'); // Haihs: mã bí mật chỉ kiểm khi bật cờ - start - end
  vi.stubEnv('MONGODB_URI', db.uri);
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
async function mkTeacher(phone = '0912345678') {
  const r = await call(teacherRegister, {
    method: 'POST',
    url: URL_,
    body: { phoneNumber: phone, fullName: 'Giao Vien', password: PW, secretKey: TEACHER_KEY },
  });
  expect(r.status).toBe(201);
  return r.body.data as { token: string; user: { id: string } };
}
async function mkStudent(phone = '0987654321') {
  const r = await call(studentRegister, {
    method: 'POST',
    url: URL_,
    body: { phoneNumber: phone, fullName: 'Hoc Sinh', password: PW },
  });
  expect(r.status).toBe(201);
  return r.body.data as { token: string; user: { id: string } };
}
const getMe = (t: string) => call(me, { url: URL_, headers: bearer(t) });
const putKey = (t: string, body: unknown) =>
  call(apiKey, { method: 'PUT', url: URL_, body, headers: bearer(t) });
const logout = (t: string) => call(logoutAll, { method: 'POST', url: URL_, headers: bearer(t) });
const change = (t: string, body: unknown) =>
  call(changePassword, { method: 'POST', url: URL_, body, headers: bearer(t) });

describe('GET /api/auth/me', () => {
  it('teacher: AuthUser with hasApiKey=false, no sensitive fields', async () => {
    const t = await mkTeacher();
    const r = await getMe(t.token);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      id: t.user.id,
      phoneNumber: '0912345678',
      role: 'teacher',
      mustChangePassword: false,
      hasApiKey: false,
    });
    const s = JSON.stringify(r.body);
    for (const k of ['password', 'geminiApiKey', 'tokenVersion', 'apiKeyLast4'])
      expect(s).not.toContain(k);
  });

  it('student: no hasApiKey / apiKeyLast4', async () => {
    const s = await mkStudent();
    const r = await getMe(s.token);
    expect(r.status).toBe(200);
    expect(r.body.data.role).toBe('student');
    expect(r.body.data).not.toHaveProperty('hasApiKey');
    expect(r.body.data).not.toHaveProperty('apiKeyLast4');
  });

  it('a user that must change password can call me, but not other (non-opted-in) routes', async () => {
    const s = await mkStudent();
    await UserModel.updateOne({ _id: s.user.id }, { mustChangePassword: true });
    expect((await getMe(s.token)).status).toBe(200);
    const other = withErrors(withAuth(async () => ok(null)));
    const r = await call(other, { url: URL_, headers: bearer(s.token) });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('MUST_CHANGE_PASSWORD');
    // api-key is a real route that must NOT opt in
    const t = await mkTeacher('0911111111');
    await UserModel.updateOne({ _id: t.user.id }, { mustChangePassword: true });
    const k = await putKey(t.token, { geminiApiKey: GEMINI });
    expect(k.status).toBe(403);
    expect(k.body.code).toBe('MUST_CHANGE_PASSWORD');
  });

  it('a corrupted stored key does not 500 me (treated as no key)', async () => {
    const t = await mkTeacher();
    await UserModel.collection.updateOne(
      { phoneNumber: '0912345678' },
      { $set: { geminiApiKey: 'enc:v1:garbage' } },
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await getMe(t.token);
    expect(r.status).toBe(200);
    expect(r.body.data.hasApiKey).toBe(false);
  });

  it('IP limiter answers 429 before touching the DB', async () => {
    const t = await mkTeacher();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_STUDENT_API_MAX', '1');
    expect((await getMe(t.token)).status).toBe(200);
    const spy = vi.spyOn(UserModel, 'findById');
    const r = await getMe(t.token);
    expect(r.status).toBe(429);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects without token (401)', async () => {
    expect((await call(me, { url: URL_ })).status).toBe(401);
  });
});

describe('PUT /api/auth/api-key', () => {
  it('sets: encrypted at rest, response only hasApiKey/apiKeyLast4, me reflects it', async () => {
    const t = await mkTeacher();
    const r = await putKey(t.token, { geminiApiKey: `  ${GEMINI}  ` });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ hasApiKey: true, apiKeyLast4: GEMINI.slice(-4) });
    expect(JSON.stringify(r.body)).not.toContain(GEMINI);
    const raw = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    expect(raw?.geminiApiKey).toMatch(/^enc:v1:/);
    expect(raw?.geminiApiKey).not.toContain(GEMINI);
    const m = await getMe(t.token);
    expect(m.body.data).toMatchObject({ hasApiKey: true, apiKeyLast4: GEMINI.slice(-4) });
    expect(JSON.stringify(m.body)).not.toContain(GEMINI);
  });

  it('empty string clears', async () => {
    const t = await mkTeacher();
    await putKey(t.token, { geminiApiKey: GEMINI });
    const r = await putKey(t.token, { geminiApiKey: '' });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ hasApiKey: false });
    expect((await getMe(t.token)).body.data.hasApiKey).toBe(false);
  });

  it.each([
    ['too long', { geminiApiKey: 'a'.repeat(513) }],
    ['number', { geminiApiKey: 123 }],
    ['missing', {}],
    ['null body', null],
    ['enc prefix', { geminiApiKey: 'enc:v1:abcdef' }],
  ])('invalid (%s) -> 400 VALIDATION geminiApiKey', async (_n, body) => {
    const t = await mkTeacher();
    const r = await putKey(t.token, body);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'VALIDATION', field: 'geminiApiKey' });
  });

  it('body over 4 KiB -> 413', async () => {
    const t = await mkTeacher();
    const r = await putKey(t.token, { geminiApiKey: 'a', pad: 'x'.repeat(5000) });
    expect(r.status).toBe(413);
  });

  it('student -> 403', async () => {
    const s = await mkStudent();
    const r = await putKey(s.token, { geminiApiKey: GEMINI });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/auth/logout-all', () => {
  it('revokes every token (old token 401), tokenVersion incremented atomically', async () => {
    const t = await mkTeacher();
    const r = await logout(t.token);
    expect(r.status).toBe(200);
    expect(r.body.data).toBeNull();
    expect((await getMe(t.token)).status).toBe(401);
    const raw = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    expect(raw?.tokenVersion).toBe(1);
  });

  it('STUDENT_API limiter (inside auth) answers 429', async () => {
    const t = await mkTeacher();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_STUDENT_API_MAX', '1');
    expect((await logout(t.token)).status).toBe(200);
    await UserModel.updateOne({ _id: t.user.id }, { tokenVersion: 0 }); // make the token valid again
    expect((await logout(t.token)).status).toBe(429);
  });

  it('works for a user that must change password', async () => {
    const s = await mkStudent();
    await UserModel.updateOne({ _id: s.user.id }, { mustChangePassword: true });
    expect((await logout(s.token)).status).toBe(200);
  });
});

describe('POST /api/auth/change-password', () => {
  const NEW = 'new-password-456';

  it('success: new token works, old token 401, mustChangePassword cleared, new password logs in', async () => {
    const s = await mkStudent();
    await UserModel.updateOne({ _id: s.user.id }, { mustChangePassword: true });
    const r = await change(s.token, { currentPassword: PW, newPassword: NEW });
    expect(r.status).toBe(200);
    expect(r.body.data.user.mustChangePassword).toBe(false);
    expect(verifyToken(r.body.data.token).tv).toBe(1);
    expect((await getMe(s.token)).status).toBe(401);
    expect((await getMe(r.body.data.token)).status).toBe(200);
    // the flagged user is now free to call other routes (api-key needs teacher, so use a plain withAuth route)
    const other = withErrors(withAuth(async () => ok(null)));
    expect((await call(other, { url: URL_, headers: bearer(r.body.data.token) })).status).toBe(200);
    const raw = await UserModel.collection.findOne({ phoneNumber: '0987654321' });
    expect(raw?.password).not.toBe(NEW);
    expect(raw?.mustChangePassword).toBe(false);
  });

  it('wrong current password -> 400 VALIDATION currentPassword, nothing changed', async () => {
    const t = await mkTeacher();
    const r = await change(t.token, { currentPassword: 'wrong-password', newPassword: NEW });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'VALIDATION', field: 'currentPassword' });
    expect((await getMe(t.token)).status).toBe(200);
  });

  it('new equals current -> 400 field newPassword', async () => {
    const t = await mkTeacher();
    const r = await change(t.token, { currentPassword: PW, newPassword: PW });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'VALIDATION', field: 'newPassword' });
  });

  it.each([
    ['short new', { currentPassword: PW, newPassword: 'short' }, 'newPassword'],
    [
      'too long new (>72 bytes)',
      { currentPassword: PW, newPassword: 'a'.repeat(73) },
      'newPassword',
    ],
    ['non-string new', { currentPassword: PW, newPassword: 12345678 }, 'newPassword'],
    ['missing current', { newPassword: NEW }, 'currentPassword'],
    ['empty current', { currentPassword: '', newPassword: NEW }, 'currentPassword'],
    ['current > 1024', { currentPassword: 'a'.repeat(1025), newPassword: NEW }, 'currentPassword'],
    ['non-object body', 'x', 'currentPassword'],
  ])('validation: %s -> 400 with field', async (_n, body, field) => {
    const t = await mkTeacher();
    const r = await change(t.token, body);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'VALIDATION', field });
  });

  it('concurrent double change: exactly one succeeds, tokenVersion incremented once', async () => {
    const t = await mkTeacher();
    const [a, b] = await Promise.all([
      change(t.token, { currentPassword: PW, newPassword: 'first-new-password' }),
      change(t.token, { currentPassword: PW, newPassword: 'second-new-password' }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([400, 401]).toContain(statuses[1]);
    const raw = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    expect(raw?.tokenVersion).toBe(1);
  });

  it('lost race on the conditional update -> 401 UNAUTHENTICATED (no double apply)', async () => {
    const t = await mkTeacher();
    const real = UserModel.findOneAndUpdate.bind(UserModel);
    vi.spyOn(UserModel, 'findOneAndUpdate').mockImplementation(((...args: unknown[]) => {
      // a logout-all lands between the read and the update
      return UserModel.updateOne({ _id: t.user.id }, { $inc: { tokenVersion: 1 } }).then(() =>
        (real as (...a: unknown[]) => unknown)(...args),
      );
    }) as never);
    const r = await change(t.token, { currentPassword: PW, newPassword: NEW });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHENTICATED');
    const raw = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    expect(raw?.tokenVersion).toBe(1);
  });

  it('logout-all landing between auth and the handler re-read -> 401, password NOT changed', async () => {
    const t = await mkTeacher();
    const real = UserModel.findById.bind(UserModel);
    let n = 0;
    vi.spyOn(UserModel, 'findById').mockImplementation(((...a: unknown[]) => {
      n++;
      if (n === 1) return (real as (...x: unknown[]) => unknown)(...a); // auth's read (tv matches the JWT)
      return UserModel.updateOne({ _id: t.user.id }, { $inc: { tokenVersion: 1 } }).then(() =>
        (real as (...x: unknown[]) => unknown)(...a),
      );
    }) as never);
    const before = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    const r = await change(t.token, { currentPassword: PW, newPassword: NEW });
    expect(r.status).toBe(401);
    const raw = await UserModel.collection.findOne({ phoneNumber: '0912345678' });
    expect(raw?.password).toBe(before?.password);
    expect(raw?.tokenVersion).toBe(1);
  });

  it('wrong current counts as a failure: 11th attempt -> 429', async () => {
    const t = await mkTeacher();
    vi.stubEnv('NODE_ENV', 'development');
    for (let i = 0; i < 10; i++) {
      expect(
        (await change(t.token, { currentPassword: 'wrong-password', newPassword: NEW })).status,
      ).toBe(400);
    }
    const r = await change(t.token, { currentPassword: PW, newPassword: NEW });
    expect(r.status).toBe(429);
  });

  it('successful change is not counted by the failures-only limiter', async () => {
    const t = await mkTeacher();
    vi.stubEnv('NODE_ENV', 'development');
    let token = t.token;
    let cur = PW;
    for (let i = 0; i < 3; i++) {
      const next = `rotated-password-${i}`;
      const r = await change(token, { currentPassword: cur, newPassword: next });
      expect(r.status).toBe(200);
      token = r.body.data.token;
      cur = next;
    }
  });

  it('SERVER_BUSY from the hash gate -> 503', async () => {
    const t = await mkTeacher();
    const ph = await import('../src/lib/passwordHash');
    vi.spyOn(ph, 'comparePassword').mockRejectedValue(
      new (await import('../src/lib/handler')).HttpError('SERVER_BUSY', 'busy'),
    );
    const r = await change(t.token, { currentPassword: PW, newPassword: NEW });
    expect(r.status).toBe(503);
  });

  it('401 without token', async () => {
    expect((await call(changePassword, { method: 'POST', url: URL_, body: {} })).status).toBe(401);
  });
});
