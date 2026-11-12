// Created by Haihs on 12/11/2026
// PUT /api/sittings/:id/submissions/:submissionId/essay/:questionId: grade one essay by hand (optimistic lock baseGradedAt).
import { withPermission } from '../../../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../../../src/lib/handler';
import { overrideEssayResult } from '../../../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const PUT = withErrors(withPermission('essay:grade', overrideEssayResult));
