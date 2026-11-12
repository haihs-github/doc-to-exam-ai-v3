// Created by Haihs on 12/11/2026
// GET /api/classes/:id/students (list), POST (add by studentId or phoneNumber). Source: memberController listStudents/addStudent.
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { addByLookup, listStudents } from '../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const GET = withErrors(withClassPermission('student:read', listStudents));
export const POST = withErrors(
  withClassPermission(
    'student:add',
    withRateLimit([LIMITERS.MEMBER_LOOKUP], addByLookup('student')),
  ),
);
