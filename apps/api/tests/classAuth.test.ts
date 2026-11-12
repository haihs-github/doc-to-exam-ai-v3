// Created by Haihs on 12/11/2026
// Tests for withClassPermission (404 for non-members, 403 for missing class permission) and guardedDeleteMember races.
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../src/lib/apiResponse';
import { withClassPermission } from '../src/lib/classAuth';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { withErrors } from '../src/lib/handler';
import { signToken } from '../src/lib/jwt';
import { seedRbac } from '../src/lib/rbac';
import { ClassModel } from '../src/models/Class';
import { ClassMemberModel } from '../src/models/ClassMember';
import { UserModel } from '../src/models/User';
import { guardedDeleteMember } from '../src/services/classMembers';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'test-secret-0123456789-abcdef');
  db = await startTestDb();
  vi.stubEnv('MONGODB_URI', db.uri);
  await mongoose.connect(db.uri);
  await ensureIndexes();
  await seedRbac();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    ClassModel.deleteMany({}),
    ClassMemberModel.deleteMany({}),
  ]);
});

let n = 0;
const mkUser = (role: 'teacher' | 'student' = 'teacher') =>
  UserModel.create({
    phoneNumber: `09100${String(n++).padStart(5, '0')}`,
    fullName: 'Nguyen Van A',
    password: 'hash-hash',
    role,
  });
const bearer = (u: { id: string; tokenVersion: number }) => ({
  authorization: `Bearer ${signToken({ id: u.id, tokenVersion: u.tokenVersion })}`,
});
const mkClass = (over: Record<string, unknown> = {}) =>
  ClassModel.create({
    createdBy: new mongoose.Types.ObjectId(),
    name: 'L',
    code: `C${n++}`,
    startYear: 2024,
    endYear: 2027,
    ...over,
  });
const join = (
  classId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  memberRole: string,
  status: 'approved' | 'pending' = 'approved',
) => ClassMemberModel.create({ classId, userId, memberRole, status, source: 'member_add' });

const seen: string[] = [];
const route = (perm: string, withDeleted?: boolean) =>
  withErrors(
    withClassPermission(
      perm,
      async (_req, ctx) => {
        seen.push(ctx.classDoc.id);
        return ok({ id: ctx.classDoc.id, role: ctx.membership.memberRole, p: ctx.params.id });
      },
      { withDeleted },
    ),
  );
const hit = async (
  h: ReturnType<typeof route>,
  u: { id: string; tokenVersion: number },
  id: string,
) => {
  const res = await h(new Request('http://localhost/x', { headers: bearer(u) }), {
    params: Promise.resolve({ id }),
  });
  return { status: res.status, body: await res.json() };
};

describe('withClassPermission', () => {
  it('lets an approved teacher member through with classDoc, membership and params', async () => {
    const t = await mkUser();
    const c = await mkClass();
    await join(c._id, t._id, 'teacher');
    const r = await hit(route('class:read'), t, c.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ id: c.id, role: 'teacher', p: c.id });
  });

  it('answers the same 404 NOT_FOUND for non-member, pending, bad id and unknown id', async () => {
    const t = await mkUser();
    const other = await mkUser();
    const pending = await mkUser();
    const c = await mkClass();
    await join(c._id, other._id, 'teacher');
    await join(c._id, pending._id, 'teacher', 'pending');
    const h = route('class:read');
    const outs = [
      await hit(h, t, c.id),
      await hit(h, pending, c.id),
      await hit(h, t, 'not-an-id'),
      await hit(h, t, '1'.repeat(24)),
      await hit(h, t, '{"$ne":null}'),
    ];
    for (const o of outs) {
      expect(o.status).toBe(404);
      expect(o.body).toEqual({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy lớp.' });
    }
  });

  it('does not touch the DB for a malformed id', async () => {
    const t = await mkUser();
    const spy = vi.spyOn(ClassModel, 'findOne');
    await hit(route('class:read'), t, 'zzz');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('403 FORBIDDEN for a member whose memberRole lacks the permission, 404 for a student outside', async () => {
    const s = await mkUser('student');
    const out = await mkUser('student');
    const c = await mkClass();
    await join(c._id, s._id, 'student');
    const h = route('class:update');
    expect((await hit(h, s, c.id)).status).toBe(403);
    expect((await hit(h, out, c.id)).status).toBe(404);
  });

  it('permission follows memberRole, not createdBy', async () => {
    const creator = await mkUser();
    const c = await mkClass({ createdBy: creator._id });
    // creator is NOT a member -> 404 even though createdBy
    expect((await hit(route('class:read'), creator, c.id)).status).toBe(404);
  });

  it('deleted class is 404 unless withDeleted', async () => {
    const t = await mkUser();
    const c = await mkClass();
    await join(c._id, t._id, 'teacher');
    await c.softDelete();
    expect((await hit(route('class:read'), t, c.id)).status).toBe(404);
    expect((await hit(route('class:restore', true), t, c.id)).status).toBe(200);
  });

  it('401 without token and config error on unknown permission', async () => {
    const res = await route('class:read')(new Request('http://localhost/x'), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(401);
    expect(() => withClassPermission('class:nope', async () => ok(null))).toThrow(
      /Unknown permission/,
    );
  });
});

describe('guardedDeleteMember', () => {
  it('removes a student and a non-last teacher; unknown member -> removed:false', async () => {
    const [t1, t2, s] = await Promise.all([mkUser(), mkUser(), mkUser('student')]);
    const c = await mkClass();
    await Promise.all([
      join(c._id, t1._id, 'teacher'),
      join(c._id, t2._id, 'teacher'),
      join(c._id, s._id, 'student'),
    ]);
    expect(await guardedDeleteMember(c._id, s._id)).toEqual({ removed: true });
    expect(await guardedDeleteMember(c._id, t2._id)).toEqual({ removed: true });
    expect(await guardedDeleteMember(c._id, t2._id)).toEqual({ removed: false });
  });

  it('refuses the last approved teacher with LAST_TEACHER', async () => {
    const t = await mkUser();
    const c = await mkClass();
    await join(c._id, t._id, 'teacher');
    await expect(guardedDeleteMember(c._id, t._id)).rejects.toMatchObject({ code: 'LAST_TEACHER' });
    expect(await ClassMemberModel.countDocuments({ classId: c._id })).toBe(1);
  });

  it('a pending teacher is removable even when no approved teacher exists', async () => {
    const t = await mkUser();
    const c = await mkClass();
    await join(c._id, t._id, 'teacher', 'pending');
    expect(await guardedDeleteMember(c._id, t._id)).toEqual({ removed: true });
  });

  it('two last teachers leaving at once never leaves 0 (repeated)', async () => {
    for (let i = 0; i < 25; i++) {
      const [a, b] = await Promise.all([mkUser(), mkUser()]);
      const c = await mkClass();
      await Promise.all([join(c._id, a._id, 'teacher'), join(c._id, b._id, 'teacher')]);
      const res = await Promise.allSettled([
        guardedDeleteMember(c._id, a._id),
        guardedDeleteMember(c._id, b._id),
      ]);
      for (const r of res)
        if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'LAST_TEACHER' });
      const left = await ClassMemberModel.countDocuments({
        classId: c._id,
        memberRole: 'teacher',
        status: 'approved',
      });
      expect(left).toBeGreaterThanOrEqual(1);
    }
  });
});
