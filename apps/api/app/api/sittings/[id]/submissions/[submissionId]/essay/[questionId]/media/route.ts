// Created by Haihs on 12/11/2026
// GET .../essay/:questionId/media: the original photo/PDF of a student's essay (owner only).
import { withPermission } from '../../../../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../../../../src/lib/handler';
import { getEssayMedia } from '../../../../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('essay:media', getEssayMedia));
