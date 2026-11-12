// Created by Haihs on 12/11/2026
// GET /api/sittings/:id/grants (who may enter), POST (grant by allInClasses/excludeStudentIds or studentIds).
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { addGrants, listGrants } from '../../../../../src/services/sittings';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('sitting:grant', listGrants));
export const POST = withErrors(withPermission('sitting:grant', addGrants));
