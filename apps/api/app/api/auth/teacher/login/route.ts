// Created by Haihs on 11/11/2026
// POST /api/auth/teacher/login (limiters: server/routes/authRoutes.js:31)
import { authRoute, loginHandler } from '../../../../../src/lib/authHandlers';
import { LIMITERS as L } from '../../../../../src/lib/limiters';

export const runtime = 'nodejs';
export const POST = authRoute([L.LOGIN], loginHandler('teacher'));
