// Created by Haihs on 11/11/2026
// Tests for the RBAC catalogue, seedRbac idempotency and hasPermission cache.
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PERMISSIONS, clearRbacCache, hasPermission, seedRbac } from '../src/lib/rbac';
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
