// Created by Haihs on 12/11/2026
// GET /api/me/sittings: sittings I was granted and still belong to (no scores). STUDENT_API first like meRoutes.
import { withPermission } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';
import { listMine } from '../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const GET = withErrors(
  withRateLimit([LIMITERS.STUDENT_API], withPermission('sitting:listMine', listMine)),
);
