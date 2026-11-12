// Created by Haihs on 12/11/2026
// GET /api/sittings (list, filters classId/status), POST (create from a template). Owner-scoped. Source: sittingRoutes.js.
import { withPermission } from '../../../src/lib/auth';
import { withErrors } from '../../../src/lib/handler';
import { createSitting, listSittings } from '../../../src/services/sittings';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('sitting:list', listSittings));
export const POST = withErrors(withPermission('sitting:create', createSitting));
