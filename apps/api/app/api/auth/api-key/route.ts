// Created by Haihs on 11/11/2026
// PUT /api/auth/api-key (source authController.js updateApiKey; authRoutes.js:53)
import type { ApiKeyBody, ApiKeyState } from '@doc-to-exam/contract';
import { ok } from '../../../../src/lib/apiResponse';
import { withPermission } from '../../../../src/lib/auth';
import { HttpError, readJson, withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';
import { last4 } from '../../../../src/lib/secureField';

export const runtime = 'nodejs';
const MAX_BODY = 4096;
const MAX_KEY = 512;

export const PUT = withErrors(
  withPermission(
    'account:updateApiKey',
    withRateLimit([LIMITERS.STUDENT_API], async (req, ctx) => {
      const body = (await readJson(req, MAX_BODY)) as Partial<ApiKeyBody> | null;
      const key = body?.geminiApiKey;
      if (typeof key !== 'string' || key.length > MAX_KEY)
        throw new HttpError('VALIDATION', 'API key không hợp lệ.', { field: 'geminiApiKey' });
      ctx.user.setGeminiApiKey(key.trim()); // the only way the key reaches the document (encrypts on set)
      await ctx.user.save();
      const stored = ctx.user.geminiApiKey; // getter never throws: an undecryptable value reads as ''
      return ok<ApiKeyState>(
        stored ? { hasApiKey: true, apiKeyLast4: last4(stored) } : { hasApiKey: false },
      );
    }),
  ),
);
