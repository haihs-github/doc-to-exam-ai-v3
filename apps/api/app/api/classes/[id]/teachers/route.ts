// Created by Haihs on 12/11/2026
// GET /api/classes/:id/teachers (list), POST (add by teacherId or phoneNumber). Source: memberController listTeachers/addTeacher.
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { addByLookup, listTeachers } from '../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const GET = withErrors(withClassPermission('teacher:read', listTeachers));
export const POST = withErrors(
  withClassPermission(
    'teacher:add',
    withRateLimit([LIMITERS.MEMBER_LOOKUP], addByLookup('teacher')),
  ),
);
