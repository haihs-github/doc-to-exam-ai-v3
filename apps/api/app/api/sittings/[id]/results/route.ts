// Created by Haihs on 12/11/2026
// GET /api/sittings/:id/results: submissions by page + stats + not-submitted list.
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { getResults } from '../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('result:read', getResults));
