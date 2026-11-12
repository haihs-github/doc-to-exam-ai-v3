// Created by Haihs on 12/11/2026
// GET /api/me/sittings/:sittingId/session: clock sync.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../../src/lib/rateLimit';
import { getSession } from '../../../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const GET = withErrors(
  withRateLimit([LIMITERS.STUDENT_API], withPermission('sitting:take', getSession)),
);
