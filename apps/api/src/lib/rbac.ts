// Created by Haihs on 11/11/2026
// RBAC: permission catalogue per role, idempotent seed, cached permission lookup (port of server/services/rbac.js).
import type { UserRole } from '@doc-to-exam/contract';
import { RoleModel } from '../models/Role';

const TEACHER = [
  'class:create',
  'class:list',
  'class:read',
  'class:update',
  'class:delete',
  'class:restore',
  'class:join',
  'class:leave',
  'invite:read',
  'invite:manage',
  'student:read',
  'student:add',
  'student:remove',
  'student:approve',
  'student:update',
  'student:resetPassword',
  'student:import',
  'teacher:read',
  'teacher:add',
  'teacher:approve',
  'teacher:remove',
  'account:changePassword',
  'account:logoutAll',
  'account:updateApiKey',
  'result:read',
  'violation:delete',
  'essay:grade',
  'essay:media',
  'template:parse',
  'template:create',
  'template:list',
  'template:read',
  'template:update',
  'template:delete',
  'template:duplicate',
  'sitting:create',
  'sitting:list',
  'sitting:read',
  'sitting:update',
  'sitting:delete',
  'sitting:grant',
  'sitting:take',
  'result:readMine',
  'result:publish',
  'template:restore',
  'template:purge',
];
const STUDENT = [
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

// admin exists in UserRole but is not seeded (source parity): no Role row = no permissions.
export const PERMISSIONS: Record<'teacher' | 'student', readonly string[]> = Object.freeze({
  teacher: TEACHER,
  student: STUDENT,
});

// Removed routes' permissions, pulled from stored roles by seedRbac (source DEPRECATED_PERMISSIONS).
export const DEPRECATED_PERMISSIONS: readonly string[] = Object.freeze([
  'exam:parse',
  'exam:create',
  'exam:list',
  'exam:read',
  'exam:update',
  'exam:delete',
  'exam:duplicate',
]);

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { permissions: Set<string>; expiresAt: number }>();
export const clearRbacCache = (): void => cache.clear();

/** Only ADDS missing defaults ($addToSet; hand-added permissions survive) and pulls obsolete ones. Idempotent. */
export async function seedRbac(): Promise<void> {
  await RoleModel.bulkWrite(
    Object.entries(PERMISSIONS).map(([name, permissions]) => ({
      updateOne: {
        filter: { name },
        update: { $addToSet: { permissions: { $each: [...permissions] } } },
        upsert: true,
      },
    })),
  );
  await RoleModel.updateMany({}, { $pull: { permissions: { $in: [...DEPRECATED_PERMISSIONS] } } });
  clearRbacCache();
}

/** Role without a row (unknown, admin) has no permission. Cached 60s per role. */
export async function hasPermission(role: UserRole, perm: string): Promise<boolean> {
  const hit = cache.get(role);
  if (hit && hit.expiresAt > Date.now()) return hit.permissions.has(perm);
  const doc = await RoleModel.findOne({ name: role }).lean();
  const permissions = new Set(doc?.permissions ?? []);
  cache.set(role, { permissions, expiresAt: Date.now() + CACHE_TTL_MS });
  return permissions.has(perm);
}
