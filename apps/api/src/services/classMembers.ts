// Created by Haihs on 12/11/2026
// Class membership services: per-role counts and race-safe member deletion that never leaves a class without a teacher.
import type { Types } from 'mongoose';
import { HttpError } from '../lib/handler';
import { ClassMemberModel } from '../models/ClassMember';

export interface RoleCounts {
  student?: number;
  teacher?: number;
  pendingStudent?: number;
  pendingTeacher?: number;
}

/** Counts members of many classes in ONE aggregate. 'all' also returns pendingStudent/pendingTeacher. */
export async function countByRole(
  classIds: Types.ObjectId[],
  scope: 'approved' | 'all' = 'approved',
): Promise<Map<string, RoleCounts>> {
  const rows = await ClassMemberModel.aggregate<{
    _id: { c: Types.ObjectId; r: string; s: string };
    n: number;
  }>([
    {
      $match: {
        classId: { $in: classIds },
        ...(scope === 'approved' ? { status: 'approved' } : {}),
      },
    },
    { $group: { _id: { c: '$classId', r: '$memberRole', s: '$status' }, n: { $sum: 1 } } },
  ]);
  const out = new Map<string, RoleCounts>();
  for (const { _id, n } of rows) {
    const entry = out.get(String(_id.c)) ?? {};
    const key = _id.s === 'approved' ? _id.r : `pending${_id.r[0].toUpperCase()}${_id.r.slice(1)}`;
    (entry as Record<string, number>)[key] = n;
    out.set(String(_id.c), entry);
  }
  return out;
}

const approvedTeachers = (classId: Types.ObjectId) =>
  ClassMemberModel.countDocuments({ classId, memberRole: 'teacher', status: 'approved' });

/**
 * Deletes one membership. The last approved teacher is never removed (throws LAST_TEACHER).
 * No transaction: delete, recount, and if the class hit 0 teachers put the caller's row back (upsert).
 * Two last teachers racing: worst case both are restored and both get LAST_TEACHER; never 0 left.
 */
export async function guardedDeleteMember(
  classId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
): Promise<{ removed: boolean }> {
  const member = await ClassMemberModel.findOne({ classId, userId });
  if (!member) return { removed: false };
  const lastTeacher = () =>
    new HttpError(
      'LAST_TEACHER',
      'Bạn là giáo viên cuối cùng của lớp. Hãy thêm giáo viên khác hoặc xóa lớp.',
    );
  if (!(member.memberRole === 'teacher' && member.status === 'approved')) {
    const r = await ClassMemberModel.deleteOne({ _id: member._id });
    return { removed: r.deletedCount > 0 };
  }
  if ((await approvedTeachers(member.classId)) <= 1) throw lastTeacher();
  const r = await ClassMemberModel.deleteOne({ _id: member._id });
  if (r.deletedCount === 0) return { removed: false };
  if ((await approvedTeachers(member.classId)) > 0) return { removed: true };
  const snapshot = member.toObject() as unknown as Record<string, unknown>;
  delete snapshot._id;
  await ClassMemberModel.updateOne(
    { classId: member.classId, userId: member.userId },
    { $setOnInsert: snapshot },
    { upsert: true },
  );
  throw lastTeacher();
}
