// Created by Haihs on 12/11/2026
// GET / PUT / DELETE (soft, to trash) /api/templates/:id. Wrong owner gives the same 404 as a missing id.
import { withPermission } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { deleteTemplate, getTemplate, updateTemplate } from '../../../../src/services/templates';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('template:read', getTemplate));
export const PUT = withErrors(withPermission('template:update', updateTemplate));
export const DELETE = withErrors(withPermission('template:delete', deleteTemplate));
