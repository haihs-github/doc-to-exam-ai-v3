// Created by Haihs on 12/11/2026
// POST /api/sittings/:id/results/publish: publish the results (idempotent, blocked while essays are ungraded).
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { publishResults } from '../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const POST = withErrors(withPermission('result:publish', publishResults));
