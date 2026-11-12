// Created by Haihs on 12/11/2026
// POST /api/sittings/:id/regenerate-code: new 6-character code (and link).
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { regenerateCode } from '../../../../../src/services/sittings';

export const runtime = 'nodejs';

export const POST = withErrors(withPermission('sitting:update', regenerateCode));
