// Created by Haihs on 12/11/2026
// POST /api/templates/:id/duplicate: copy as "<name> (bản sao)"; 10/min per user.
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { duplicateTemplate } from '../../../../../src/services/templates';

export const runtime = 'nodejs';

export const POST = withErrors(
  withPermission('template:duplicate', withRateLimit([LIMITERS.DUPLICATE], duplicateTemplate)),
);
