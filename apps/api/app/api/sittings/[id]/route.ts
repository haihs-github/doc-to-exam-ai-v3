// Created by Haihs on 12/11/2026
// GET / PUT / DELETE /api/sittings/:id (owner only; wrong owner = the same 404).
import { withPermission } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { deleteSitting, getSitting, updateSitting } from '../../../../src/services/sittings';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('sitting:read', getSitting));
export const PUT = withErrors(withPermission('sitting:update', updateSitting));
export const DELETE = withErrors(withPermission('sitting:delete', deleteSitting));
