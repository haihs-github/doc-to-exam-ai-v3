// Created by Haihs on 12/11/2026
// POST /api/me/sittings/resolve {code}: code -> sitting info. Only WRONG attempts count (user limiter first, then IP), against code guessing.
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { resolve } from '../../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const POST = withErrors(
  withRateLimit(
    [LIMITERS.STUDENT_API],
    withPermission(
      'sitting:take',
      withRateLimit([LIMITERS.SITTING_RESOLVE, LIMITERS.SITTING_RESOLVE_IP], resolve),
    ),
  ),
);
