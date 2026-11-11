// Created by Haihs on 11/11/2026
// Pure client-side input rules for phone / password / full name (port of client authRules.js; server decides).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72; // bcrypt limit
export const FULL_NAME_MAX = 255;

const PHONE_RE = /^0\d{9,10}$/;
const FULL_NAME_RE = new RegExp(`^[\\p{L}\\p{M}][\\p{L}\\p{M} .'-]{1,${FULL_NAME_MAX - 1}}$`, 'u');

/** Same normalisation as the API: '' for non-strings / raw input over 32 chars; else trim and strip whitespace, dots, dashes. */
export const normalizePhone = (raw: unknown): string =>
  typeof raw !== 'string' || raw.length > 32 ? '' : raw.trim().replace(/[\s.-]/g, ''); // same as apps/api/src/lib/phone.ts

export const validatePhone = (s: string): boolean => PHONE_RE.test(normalizePhone(s));

/** '' when valid, else the Vietnamese message (client authRules.js validatePhone); judged on the normalised value. */
export const phoneError = (raw: string): string => {
  const v = normalizePhone(raw);
  if (!v) return 'Vui lòng nhập số điện thoại.';
  if (v.startsWith('+'))
    return 'Không dùng định dạng +84. Hãy nhập số bắt đầu bằng 0, ví dụ 0912345678.';
  if (!/^[0-9]+$/.test(v)) return 'Số điện thoại chỉ gồm chữ số.';
  if (!v.startsWith('0')) return 'Số điện thoại phải bắt đầu bằng 0.';
  return PHONE_RE.test(v) ? '' : 'Số điện thoại phải gồm 10-11 chữ số.';
};

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

/** NFC, trimmed, inner whitespace collapsed (what the form sends and validates). */
export const normalizeFullName = (s: string): string =>
  String(s ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');

/** Full name: trimmed/collapsed spaces, 2-255 chars, starts with a letter, no digits/special chars. */
export const validateFullName = (s: string): boolean => FULL_NAME_RE.test(normalizeFullName(s));

const nameError = (raw: string): string => {
  if (!String(raw ?? '').trim()) return 'Vui lòng nhập họ và tên.';
  return validateFullName(raw)
    ? ''
    : 'Họ và tên không hợp lệ (2 đến 255 ký tự, bắt đầu bằng chữ cái, không chứa chữ số hay ký tự đặc biệt).';
};

export const LOGIN_ORDER = ['phoneNumber', 'password'] as const;
export const REGISTER_ORDER = ['fullName', 'phoneNumber', 'password', 'secretKey'] as const;
export const CHANGE_PASSWORD_ORDER = ['currentPassword', 'newPassword', 'confirmPassword'] as const;

export type FormErrors = Record<string, string>;

export const validateLoginForm = (v: { phoneNumber: string; password: string }): FormErrors => {
  const e: FormErrors = {};
  if (!String(v.phoneNumber ?? '').trim()) e['phoneNumber'] = 'Vui lòng nhập số điện thoại.';
  if (!v.password) e['password'] = 'Vui lòng nhập mật khẩu.';
  return e;
};

export const validateRegisterForm = (
  v: { fullName: string; phoneNumber: string; password: string; secretKey: string },
  opts: { isTeacher?: boolean } = {},
): FormErrors => {
  const e: FormErrors = {};
  const n = nameError(v.fullName);
  const p = phoneError(v.phoneNumber);
  const pw = validatePasswordInput(v.password);
  if (n) e['fullName'] = n;
  if (p) e['phoneNumber'] = p;
  if (!pw.ok) e['password'] = pw.message ?? '';
  if (opts.isTeacher && !String(v.secretKey ?? '').trim())
    e['secretKey'] = 'Vui lòng nhập mã bí mật giáo viên.';
  return e;
};

export const validateChangePasswordForm = (v: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): FormErrors => {
  const e: FormErrors = {};
  const check = validatePasswordInput(v.newPassword);
  if (!v.currentPassword) e['currentPassword'] = 'Vui lòng nhập mật khẩu hiện tại.';
  if (!check.ok) e['newPassword'] = check.message ?? '';
  else if (v.newPassword === v.currentPassword)
    e['newPassword'] = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  if (!v.confirmPassword) e['confirmPassword'] = 'Vui lòng nhập lại mật khẩu mới.';
  else if (v.newPassword !== v.confirmPassword)
    e['confirmPassword'] = 'Mật khẩu nhập lại không khớp.';
  return e;
};

/** Live re-validation: keep only the errors already shown that are still wrong (never adds new ones). */
export const refreshErrors = <V>(
  prev: FormErrors,
  validate: (v: V) => FormErrors,
  values: V,
): FormErrors => {
  const fresh = validate(values);
  return Object.fromEntries(
    Object.keys(prev)
      .filter((k) => fresh[k])
      .map((k) => [k, fresh[k]]),
  );
};
