// Created by Haihs on 12/11/2026
// DELETE .../violations/:index[?at=]: remove one violation log entry atomically.
import { withPermission } from '../../../../../../../../src/lib/auth';
import { withErrors } from '../../../../../../../../src/lib/handler';
import { deleteViolationLog } from '../../../../../../../../src/services/sittingResults';

export const runtime = 'nodejs';

export const DELETE = withErrors(withPermission('violation:delete', deleteViolationLog));
