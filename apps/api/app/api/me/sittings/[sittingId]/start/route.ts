// Created by Haihs on 12/11/2026
// POST /api/me/sittings/:sittingId/start: open or resume the session (the server holds the clock) and get the questions without answers.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../../src/lib/rateLimit';
import { start } from '../../../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const POST = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withPermission(
      'sitting:take',
      withRateLimit([LIMITERS.SITTING_START, LIMITERS.SITTING_START_USER], start),
    ),
  ),
);
