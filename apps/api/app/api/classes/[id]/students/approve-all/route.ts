// Created by Haihs on 12/11/2026
// POST /api/classes/:id/students/approve-all: approve every pending student in one update.
import { withClassPermission } from '../../../../../../src/lib/classAuth';
import { withErrors } from '../../../../../../src/lib/handler';
import { approveAllStudents } from '../../../../../../src/services/memberHandlers';

export const runtime = 'nodejs';

export const POST = withErrors(withClassPermission('student:approve', approveAllStudents));
