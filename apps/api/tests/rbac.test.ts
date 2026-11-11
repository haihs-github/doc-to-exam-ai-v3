// Created by Haihs on 11/11/2026
// Tests for the RBAC catalogue, seedRbac idempotency and hasPermission cache.
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, clearRbacCache, hasPermission, seedRbac } from '../src/lib/rbac';
import { ensureIndexes } from '../src/lib/ensureIndexes';
import { UserModel } from '../src/models/User';
import { RoleModel } from '../src/models/Role';
import { startTestDb } from './helpers';

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb();
  await mongoose.connect(db.uri);
  await RoleModel.init();
});
afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});
beforeEach(async () => {
  await RoleModel.deleteMany({});
  clearRbacCache();
});

describe('seedRbac', () => {
  it('is idempotent: one doc per role, exact catalogue, no duplicates', async () => {
    await seedRbac();
    await seedRbac();
    const roles = await RoleModel.find().lean();
    expect(roles.map((r) => r.name).sort()).toEqual(['student', 'teacher']);
    for (const r of roles)
      expect([...r.permissions].sort()).toEqual(
        [...PERMISSIONS[r.name as 'teacher' | 'student']].sort(),
      );
  });

  it('pulls obsolete exam:* permissions and keeps hand-added ones', async () => {
    await RoleModel.create({ name: 'teacher', permissions: ['exam:read', 'custom:thing'] });
    await seedRbac();
    const t = await RoleModel.findOne({ name: 'teacher' }).lean();
    expect(t?.permissions).not.toContain('exam:read');
    expect(t?.permissions).toContain('custom:thing');
  });
});

describe('hasPermission', () => {
  it('student lacks template:create, teacher has it', async () => {
    await seedRbac();
    expect(await hasPermission('student', 'template:create')).toBe(false);
    expect(await hasPermission('teacher', 'template:create')).toBe(true);
    expect(await hasPermission('student', 'sitting:take')).toBe(true);
  });

  it('caches within TTL and refreshes after clearRbacCache', async () => {
    await seedRbac();
    expect(await hasPermission('student', 'class:join')).toBe(true);
    await RoleModel.updateOne({ name: 'student' }, { $pull: { permissions: 'class:join' } });
    expect(await hasPermission('student', 'class:join')).toBe(true);
    clearRbacCache();
    expect(await hasPermission('student', 'class:join')).toBe(false);
  });

  it('unknown role and admin (no seeded permissions) are false', async () => {
    await seedRbac();
    expect(await hasPermission('admin', 'class:list')).toBe(false);
    expect(await hasPermission('ghost' as never, 'class:list')).toBe(false);
  });
});

afterEach(() => vi.useRealTimers());

// literal expectations copied from server/services/rbac.js
const STUDENT_LITERAL = [
  'class:join',
  'class:leave',
  'enrollment:read',
  'classmate:read',
  'account:changePassword',
  'account:logoutAll',
  'sitting:take',
  'sitting:listMine',
  'result:readMine',
];

describe('catalogue literals', () => {
  it('student has exactly the 9 source codes, no template:* / class:create; teacher has 46 unique', () => {
    expect([...PERMISSIONS.student].sort()).toEqual([...STUDENT_LITERAL].sort());
    expect(PERMISSIONS.student.some((p) => p.startsWith('template:') || p === 'class:create')).toBe(
      false,
    );
    expect(PERMISSIONS.teacher).toHaveLength(46);
    expect(new Set(PERMISSIONS.teacher).size).toBe(46);
  });
});

describe('cache TTL and unknown roles', () => {
  it('expires after 60s (fake timers)', async () => {
    await seedRbac();
    vi.useFakeTimers({ toFake: ['Date'] });
    expect(await hasPermission('student', 'class:join')).toBe(true);
    await RoleModel.updateOne({ name: 'student' }, { $pull: { permissions: 'class:join' } });
    vi.setSystemTime(Date.now() + 59_000);
    expect(await hasPermission('student', 'class:join')).toBe(true);
    vi.setSystemTime(Date.now() + 2_000);
    expect(await hasPermission('student', 'class:join')).toBe(false);
  });

  it('role outside the enum is false without a DB hit', async () => {
    const spy = vi.spyOn(RoleModel, 'findOne');
    expect(await hasPermission('ghost' as never, 'class:list')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ensureIndexes', () => {
  it('creates unique indexes on phoneNumber and name', async () => {
    await ensureIndexes();
    const u = await UserModel.collection.indexes();
    const r = await RoleModel.collection.indexes();
    expect(u.some((i) => i.key.phoneNumber === 1 && i.unique)).toBe(true);
    expect(r.some((i) => i.key.name === 1 && i.unique)).toBe(true);
  });
});
