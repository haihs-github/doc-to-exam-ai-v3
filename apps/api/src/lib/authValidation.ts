// Created by Haihs on 11/11/2026
// Input validation for register/login (port of makeRegister/makeLogin checks in source server/controllers/authController.js).
import { createHash, timingSafeEqual } from 'node:crypto';
import type { LoginBody, RegisterBody } from '@doc-to-exam/contract';
import { loadEnv } from './env';
import { HttpError } from './handler';
import { assertPasswordPolicy } from './passwordHash';
import { normalizePhone, PHONE_RE } from './phone';
import { toProperName } from './textUtils';

const FULL_NAME_MAX = 255; // same as the User model
// First char a letter/mark, then letters, marks, space . ' - (blocks digits and CSV-injection chars); source utils/textUtils.js:29
const FULL_NAME_RE = new RegExp(`^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]{1,${FULL_NAME_MAX - 1}}$`, 'u');
const MAX_GEMINI_KEY = 512; // Haihs: giới hạn độ dài geminiApiKey ≤ 512 - start - end
export const MAX_LOGIN_PASSWORD = 1024; // longer than this is never a real password: skip bcrypt

const bad = (message: string, field?: string) =>
  new HttpError('VALIDATION', message, field ? { field } : undefined);
const asObject = (body: unknown): Record<string, unknown> => {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw bad('Dữ liệu không hợp lệ.');
  return body as Record<string, unknown>;
};

/** Normalised phone or HttpError VALIDATION field phoneNumber. Used by register and login. */
export function parsePhone(raw: unknown): string {
  const phone = normalizePhone(raw);
  if (!PHONE_RE.test(phone))
    throw bad(
      'Số điện thoại phải bắt đầu bằng 0, gồm 10-11 chữ số (không dùng +84).',
      'phoneNumber',
    );
  return phone;
}

// SHA-256 first so both buffers have the same length (timingSafeEqual) and neither length nor prefix leaks.
const secretMatches = (given: string, expected: string) =>
  timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(expected).digest(),
  );

/**
 * Whitelist of fields: role, tokenVersion, mustChangePassword never come from the body. Students never get
 * secretKey/geminiApiKey (source ignores them). The teacher secret is checked here, before any hashing.
 */
export function validateRegister(body: unknown, audience: 'teacher' | 'student'): RegisterBody {
  const b = asObject(body);
  if (b.website) throw bad('Yêu cầu không hợp lệ.'); // honeypot for bots: generic on purpose
  const phoneNumber = parsePhone(b.phoneNumber);
  const fullName = toProperName(b.fullName);
  if (typeof fullName !== 'string' || !FULL_NAME_RE.test(fullName))
    throw bad(
      `Họ và tên không hợp lệ (2 đến ${FULL_NAME_MAX} ký tự, bắt đầu bằng chữ cái, không chứa chữ số hay ký tự đặc biệt).`,
      'fullName',
    );
  const password = b.password as string;
  assertPasswordPolicy(password);
  const out: RegisterBody = { phoneNumber, fullName, password };
  if (audience === 'teacher') {
    if (
      typeof b.secretKey !== 'string' ||
      !secretMatches(b.secretKey.trim(), loadEnv().teacherSecretKey)
    )
      throw new HttpError(
        'SECRET_KEY_INVALID',
        'Mã bí mật (Secret Key) không chính xác. Bạn không có quyền đăng ký tài khoản giáo viên.',
      );
    // Haihs: giới hạn độ dài geminiApiKey ≤ 512 - start
    // đóng code cũ
    // if (typeof b.geminiApiKey === 'string' && b.geminiApiKey.trim())
    //   out.geminiApiKey = b.geminiApiKey.trim();
    const key = typeof b.geminiApiKey === 'string' ? b.geminiApiKey.trim() : '';
    if (key.length > MAX_GEMINI_KEY) throw bad('API key không hợp lệ.', 'geminiApiKey');
    if (key) out.geminiApiKey = key;
    // Haihs: giới hạn độ dài geminiApiKey ≤ 512 - end
  }
  return out;
}

/** Phone is normalised+validated; password must be a non-empty string (length is judged by the handler). */
export function validateLogin(body: unknown): LoginBody {
  const b = asObject(body);
  if (typeof b.password !== 'string' || !b.password)
    throw bad('Vui lòng nhập đầy đủ Số điện thoại và Mật khẩu.');
  return { phoneNumber: parsePhone(b.phoneNumber), password: b.password };
}
