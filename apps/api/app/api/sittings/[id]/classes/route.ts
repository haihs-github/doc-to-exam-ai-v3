// Created by Haihs on 12/11/2026
// PUT /api/sittings/:id/classes {classIds}: change the class set (optimistic lock, grants cleaned).
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { updateClasses } from '../../../../../src/services/sittings';

export const runtime = 'nodejs';

export const PUT = withErrors(withPermission('sitting:update', updateClasses));
