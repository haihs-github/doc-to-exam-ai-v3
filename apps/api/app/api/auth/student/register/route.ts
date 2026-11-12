// Created by Haihs on 11/11/2026
// POST /api/auth/student/register (limiters: server/routes/authRoutes.js:32)
import { authRoute, registerHandler } from '../../../../../src/lib/authHandlers';
import { LIMITERS as L } from '../../../../../src/lib/limiters';

export const runtime = 'nodejs';
export const POST = authRoute([L.STUDENT_REGISTER, L.REGISTER_PHONE], registerHandler('student'));
