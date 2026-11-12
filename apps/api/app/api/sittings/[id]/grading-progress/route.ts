// Created by Haihs on 12/11/2026
// GET /api/sittings/:id/grading-progress: graded / pending essay submissions.
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { getGradingProgress } from '../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('result:read', getGradingProgress));
