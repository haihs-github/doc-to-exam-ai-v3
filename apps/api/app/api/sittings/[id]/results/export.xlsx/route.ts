// Created by Haihs on 12/11/2026
// GET /api/sittings/:id/results/export.xlsx: the results as an .xlsx file.
import { withPermission } from '../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../src/lib/handler';
import { exportResultsXlsx } from '../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('result:read', exportResultsXlsx));
