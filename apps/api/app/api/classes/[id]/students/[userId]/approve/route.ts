// Created by Haihs on 12/11/2026
// POST /api/classes/:id/students/:userId/approve: approve one pending student.
import { withClassPermission } from '../../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../../src/lib/handler';
import { approveOne } from '../../../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const POST = withErrors(withClassPermission('student:approve', approveOne('student')));
