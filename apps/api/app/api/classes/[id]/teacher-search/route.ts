// Created by Haihs on 12/11/2026
// GET /api/classes/:id/teacher-search?q=: find teacher accounts to add (name >=3 chars or phone digits >=3).
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { searchUsers } from '../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const GET = withErrors(
  withClassPermission(
    'teacher:add',
    withRateLimit([LIMITERS.MEMBER_SEARCH, LIMITERS.MEMBER_SEARCH_DAY], searchUsers('teacher')),
  ),
);
