// Created by Haihs on 12/11/2026
// POST /api/sittings/:id/grants/revoke {studentIds}: withdraw grants and unfinished sessions (never touches submitted students).
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { revokeGrants } from '../../../../../../src/services/sittings';

export const runtime = 'nodejs';

export const POST = withErrors(withPermission('sitting:grant', revokeGrants));
