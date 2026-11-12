// Created by Haihs on 12/11/2026
// GET /api/me/classes: classes of the signed-in student with the membership status. Source: meRoutes.js, classController myClasses.
import { ok } from '../../../../src/lib/apiResponse';
import { withPermission } from '../../../../src/lib/auth';
import { toClassDto } from '../../../../src/lib/classDto';
import { withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';
import { ClassModel } from '../../../../src/models/Class';
import { ClassMemberModel } from '../../../../src/models/ClassMember';

export const runtime = 'nodejs';

export const GET = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withPermission('enrollment:read', async (_req, { user }) => {
      const mine = await ClassMemberModel.find({ userId: user._id, memberRole: 'student' })
        .select('classId status')
        .lean();
      const status = new Map(mine.map((m) => [String(m.classId), m.status]));
      // Through ClassModel (soft-delete filter): a deleted class disappears even if the member row remains.
      const classes = await ClassModel.find({ _id: { $in: mine.map((m) => m.classId) } })
        .select('name code startYear endYear status deletedAt')
        .lean();
      classes.sort(
        (a, b) =>
          b.startYear - a.startYear ||
          b.endYear - a.endYear ||
          (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1) ||
          a.name.localeCompare(b.name, 'vi'),
      );
      return ok(classes.map((c) => toClassDto(c, { membershipStatus: status.get(String(c._id)) })));
    }),
  ),
);
