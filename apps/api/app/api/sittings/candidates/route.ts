// Created by Haihs on 12/11/2026
// GET /api/sittings/candidates?classIds=a,b&q=: approved students of the chosen classes (you must teach them, classes active).
import { withPermission } from '../../../../src/lib/auth';
import { withErrors } from '../../../../src/lib/handler';
import { candidates } from '../../../../src/services/sittings';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('sitting:create', candidates));
