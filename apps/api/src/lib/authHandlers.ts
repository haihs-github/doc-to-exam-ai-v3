// Created by Haihs on 11/11/2026
// Register/login handlers for both audiences (port of makeRegister/makeLogin, source server/controllers/authController.js:230-290).
import type { AuthResult } from '@doc-to-exam/contract';
// import { fail, ok } from './apiResponse'; // Haihs: đóng code cũ, fail không còn dùng gây lỗi lint no-unused-vars - start - end
import { ok } from './apiResponse'; // Haihs: bỏ fail không còn dùng gây lỗi lint no-unused-vars - start - end
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

// Haihs: isDuplicateKey giới hạn độ sâu cause (5) để cause tự tham chiếu không treo - start
// đóng code cũ
// const isDuplicateKey = (e: unknown): boolean => {
//   const x = e as { code?: unknown; cause?: unknown } | null;
//   return x?.code === 11000 || (!!x?.cause && isDuplicateKey(x.cause));
// };
const isDuplicateKey = (e: unknown, depth = 0): boolean => {
  const x = e as { code?: unknown; cause?: unknown } | null;
  return x?.code === 11000 || (depth < 5 && !!x?.cause && isDuplicateKey(x.cause, depth + 1));
};
// Haihs: isDuplicateKey giới hạn độ sâu cause (5) để cause tự tham chiếu không treo - end

export const registerHandler =
  (audience: Audience): Handler =>
  async (req) => {
    const body = validateRegister(await readJson(req), audience); // secret check happens here, before hashing
    await connectDb();
    // Haihs: dựng doc + setGeminiApiKey trước hashPassword để key sai không tốn bcrypt - start
    // đóng code cũ
    // const user = new UserModel({
    //   phoneNumber: body.phoneNumber,
    //   fullName: body.fullName,
    //   password: await hashPassword(body.password),
    //   role: audience, // the route decides the role, never the body
    // });
    // if (body.geminiApiKey) user.setGeminiApiKey(body.geminiApiKey);
    const user = new UserModel({
      phoneNumber: body.phoneNumber,
      fullName: body.fullName,
      role: audience, // the route decides the role, never the body
    });
    if (body.geminiApiKey) user.setGeminiApiKey(body.geminiApiKey);
    user.password = await hashPassword(body.password);
    // Haihs: dựng doc + setGeminiApiKey trước hashPassword để key sai không tốn bcrypt - end
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

// Haihs: authRoute đơn giản lại, withRateLimit đã tính HttpError theo status và withErrors đã thêm Retry-After - start
// đóng code cũ
// /**
//  * withErrors is applied INSIDE withRateLimit too: the limiters with count 'failures' only see 4xx when the handler
//  * returns a response, a thrown HttpError would be counted as a 500 and never limit anything. SERVER_BUSY gets Retry-After.
//  */
// export const authRoute = (limiters: RateLimiter[], h: Handler): Handler =>
//   withErrors(
//     withRateLimit(
//       limiters,
//       withErrors(async (req, ctx) => {
//         try {
//           return await h(req, ctx);
//         } catch (e) {
//           if (e instanceof HttpError && e.code === 'SERVER_BUSY') {
//             const res = fail(e.code, e.message);
//             res.headers.set('Retry-After', '5');
//             return res;
//           }
//           throw e;
//         }
//       }),
//     ),
//   );
export const authRoute = (limiters: RateLimiter[], h: Handler): Handler =>
  withErrors(withRateLimit(limiters, h));
// Haihs: authRoute đơn giản lại, withRateLimit đã tính HttpError theo status và withErrors đã thêm Retry-After - end
