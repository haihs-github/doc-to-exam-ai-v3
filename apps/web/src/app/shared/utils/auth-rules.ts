// Created by Haihs on 11/11/2026
// Pure client-side input rules for phone / password / full name (port of client authRules.js; server decides).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt limit
export const FULL_NAME_MAX = 255;

const PHONE_RE = /^0\d{9,10}$/;
const FULL_NAME_RE = new RegExp(`^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]{1,${FULL_NAME_MAX - 1}}$`, 'u');

export const validatePhone = (s: string): boolean => PHONE_RE.test((s ?? '').trim());

/** NEW password: >= 8 characters, <= 72 UTF-8 bytes. */
export const validatePasswordInput = (s: string): { ok: boolean; message?: string } => {
  if (typeof s !== 'string' || [...s].length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  if (new TextEncoder().encode(s).length > MAX_PASSWORD_BYTES) {
    return {
      ok: false,
      message: `Mật khẩu quá dài (tối đa ${MAX_PASSWORD_BYTES} byte, ký tự có dấu chiếm nhiều byte hơn).`,
    };
  }
  return { ok: true };
};

/** Full name: trimmed/collapsed spaces, 2-255 chars, starts with a letter, no digits/special chars. */
export const validateFullName = (s: string): boolean =>
  FULL_NAME_RE.test(
    String(s ?? '')
      .normalize('NFC')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' '),
  );
