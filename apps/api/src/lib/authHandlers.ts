// Created by Haihs on 11/11/2026
// Register/login handlers for both audiences (port of makeRegister/makeLogin, source server/controllers/authController.js:230-290).
import type { AuthResult } from '@doc-to-exam/contract';
import { fail, ok } from './apiResponse';
import { MAX_LOGIN_PASSWORD, validateLogin, validateRegister } from './authValidation';
import { connectDb } from './db';
import { HttpError, readJson, withErrors, type Handler } from './handler';
import { signToken } from './jwt';
import { compareDummy, comparePassword, hashPassword } from './passwordHash';
import { withRateLimit, type RateLimiter } from './rateLimit';
import { UserModel } from '../models/User';

type Audience = 'teacher' | 'student';

// Same body and status for wrong password, unknown phone and wrong audience: never reveal which accounts exist.
const invalid = () =>
  new HttpError('INVALID_CREDENTIALS', 'Số điện thoại hoặc mật khẩu không chính xác.');

const authResult = (user: InstanceType<typeof UserModel>): AuthResult => ({
  token: signToken({ id: user.id, tokenVersion: user.tokenVersion }),
  user: user.toAuthUser(),
});

const isDuplicateKey = (e: unknown): boolean => {
  const x = e as { code?: unknown; cause?: unknown } | null;
  return x?.code === 11000 || (!!x?.cause && isDuplicateKey(x.cause));
};

export const registerHandler =
  (audience: Audience): Handler =>
  async (req) => {
    const body = validateRegister(await readJson(req), audience); // secret check happens here, before hashing
    await connectDb();
    const user = new UserModel({
      phoneNumber: body.phoneNumber,
      fullName: body.fullName,
      password: await hashPassword(body.password),
      role: audience, // the route decides the role, never the body
    });
    if (body.geminiApiKey) user.setGeminiApiKey(body.geminiApiKey);
    try {
      await user.save();
    } catch (e) {
      // Race-safe: rely on the unique index instead of a pre-check.
      if (isDuplicateKey(e))
        throw new HttpError('PHONE_TAKEN', 'Số điện thoại này đã được đăng ký tài khoản.');
      throw e;
    }
    return ok(authResult(user), { status: 201 });
  };

export const loginHandler =
  (audience: Audience): Handler =>
  async (req) => {
    const { phoneNumber, password } = validateLogin(await readJson(req));
    if (password.length > MAX_LOGIN_PASSWORD) throw invalid(); // DoS guard: no bcrypt on absurd input
    await connectDb();
    const user = await UserModel.findOne({ phoneNumber });
    // Unknown user runs a dummy compare so timing matches; a wrong-audience user gets a real compare.
    const passwordOk = user
      ? await comparePassword(password, user.password)
      : (await compareDummy(password), false);
    if (!user || !passwordOk || user.role !== audience) throw invalid();
    return ok(authResult(user));
  };

/**
 * withErrors is applied INSIDE withRateLimit too: the limiters with count 'failures' only see 4xx when the handler
 * returns a response, a thrown HttpError would be counted as a 500 and never limit anything. SERVER_BUSY gets Retry-After.
 */
export const authRoute = (limiters: RateLimiter[], h: Handler): Handler =>
  withErrors(
    withRateLimit(
      limiters,
      withErrors(async (req, ctx) => {
        try {
          return await h(req, ctx);
        } catch (e) {
          if (e instanceof HttpError && e.code === 'SERVER_BUSY') {
            const res = fail(e.code, e.message);
            res.headers.set('Retry-After', '5');
            return res;
          }
          throw e;
        }
      }),
    ),
  );
