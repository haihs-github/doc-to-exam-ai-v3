// Created by Haihs on 11/11/2026
// GET /api/auth/me (source authController.js getMe; limiter studentApiLimiter, authRoutes.js:51)
import type { AuthUser } from '@doc-to-exam/contract';
import { ok } from '../../../../src/lib/apiResponse';
import { withAuth } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';

export const runtime = 'nodejs';
// IP limiter OUTSIDE auth: a flood of valid tokens is stopped before it reaches the DB.
export const GET = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withAuth(async (_req, ctx) => ok<AuthUser>(ctx.user.toAuthUser()), {
      allowWhenMustChangePassword: true,
    }),
  ),
);
