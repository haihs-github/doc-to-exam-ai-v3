// Created by Haihs on 12/11/2026
// GET /api/sittings/:id/results/export: every submission as JSON for the client-built CSV.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { exportResults } from '../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('result:read', exportResults));
