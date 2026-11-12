// Created by Haihs on 12/11/2026
// POST /api/me/sittings/:sittingId/submit: grade mcq on the server, store the submission; at most 2MB of JSON.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../../src/lib/rateLimit';
import { submit } from '../../../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const POST = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withPermission(
      'sitting:take',
      withRateLimit([LIMITERS.SITTING_SUBMIT, LIMITERS.SITTING_SUBMIT_USER], submit),
    ),
  ),
);
