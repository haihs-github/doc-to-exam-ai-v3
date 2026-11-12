// Created by Haihs on 12/11/2026
// GET /api/me/sittings/:sittingId/result/essay/:questionId/media: my own essay photo/PDF; past its retention -> 410.
import { withPermission } from '../../../../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../../../../../src/lib/rateLimit';
import { getResultMedia } from '../../../../../../../../../src/services/meSittings';

export const runtime = 'nodejs';

export const GET = withErrors(
  withPermission(
    'result:readMine',
    withRateLimit([LIMITERS.RESULT_VIEW_USER, LIMITERS.RESULT_VIEW], getResultMedia),
  ),
);
