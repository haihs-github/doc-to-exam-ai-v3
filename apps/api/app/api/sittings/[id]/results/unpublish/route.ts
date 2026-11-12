// Created by Haihs on 12/11/2026
// POST /api/sittings/:id/results/unpublish: withdraw the publication.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { unpublishResults } from '../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const POST = withErrors(withPermission('result:publish', unpublishResults));
