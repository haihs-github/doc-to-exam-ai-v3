// Created by Haihs on 12/11/2026
// GET /api/me/classes/:classId (approved student: teacher and classmate NAMES only), DELETE (leave or cancel a request).
import { fail, ok, toObjectId } from '../../../../../src/lib/apiResponse';
import { withPermission } from '../../../../../src/lib/auth';
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { toClassDto } from '../../../../../src/lib/classDto';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { ClassModel } from '../../../../../src/models/Class';
import { ClassMemberModel } from '../../../../../src/models/ClassMember';
import { UserModel } from '../../../../../src/models/User';
import { guardedDeleteMember } from '../../../../../src/services/classMembers';

export const runtime = 'nodejs';

// Must be an APPROVED member of the class (classmate:read inside the class); pending / outsider -> 404.
export const GET = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withClassPermission(
      'classmate:read',
      async (_req, { classDoc }) => {
        const rows = await ClassMemberModel.find({ classId: classDoc._id, status: 'approved' })
          .select('userId memberRole')
          .lean();
        const users = await UserModel.find({ _id: { $in: rows.map((r) => r.userId) } })
          .select('fullName nameSearch')
          .sort({ nameSearch: 1 })
          .lean();
        const roleOf = new Map(rows.map((r) => [String(r.userId), r.memberRole]));
        const namesOf = (role: string) =>
          users.filter((u) => roleOf.get(String(u._id)) === role).map((u) => u.fullName); // names only: no phone, no id
        return ok(
          toClassDto(classDoc, { teachers: namesOf('teacher'), classmates: namesOf('student') }),
        );
      },
      { param: 'classId' },
    ),
  ),
);

export const DELETE = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withPermission('class:leave', async (_req, ctx) => {
      const params = ((await ctx.params) ?? {}) as Record<string, string>;
      const classId = toObjectId(params.classId);
      const member = classId
        ? await ClassMemberModel.findOne({ classId, userId: ctx.user._id })
        : null;
      const cls = member ? await ClassModel.findOne({ _id: classId }) : null;
      if (!member || !cls) return fail('NOT_FOUND', 'Không tìm thấy lớp.');
      await guardedDeleteMember(member.classId, member.userId); // LAST_TEACHER for the last teacher
      return ok(null, {
        message: member.status === 'pending' ? 'Đã hủy yêu cầu tham gia.' : 'Đã rời lớp.',
      });
    }),
  ),
);
