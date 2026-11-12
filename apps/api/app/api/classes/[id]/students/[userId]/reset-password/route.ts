// Created by Haihs on 12/11/2026
// POST /api/classes/:id/students/:userId/reset-password: new temporary password (shown once, no-store). Source: resetStudentPassword.
import { withClassPermission } from '../../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../../../src/lib/rateLimit';
import { resetStudentPassword } from '../../../../../../../src/services/studentAdmin';

export const runtime = 'nodejs';

// Limiter INSIDE the permission wrapper (keyed by user), as in the source route order.
export const POST = withErrors(
  withClassPermission(
    'student:resetPassword',
    withRateLimit([LIMITERS.RESET_PASSWORD], resetStudentPassword),
  ),
);
