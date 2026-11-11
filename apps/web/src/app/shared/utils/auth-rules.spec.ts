// Created by Haihs on 11/11/2026
// Specs for pure auth input rules (ported from client/tests/authRules.test.js).
import {
  CHANGE_PASSWORD_ORDER,
  LOGIN_ORDER,
  REGISTER_ORDER,
  normalizeFullName,
  normalizePhone,
  phoneError,
  refreshErrors,
  validateChangePasswordForm,
  validateFullName,
  validateLoginForm,
  validatePasswordInput,
  validatePhone,
  validateRegisterForm,
} from './auth-rules';

describe('validatePhone', () => {
  it('nhận 10-11 chữ số bắt đầu bằng 0', () => {
    expect(validatePhone('0912345678')).toBe(true);
    expect(validatePhone('01234567890')).toBe(true);
  });
  it('từ chối +84, thiếu số 0, sai độ dài, rỗng (khoảng trắng/dấu chấm được chuẩn hóa như API)', () => {
    expect(validatePhone('091 234 5678')).toBe(true);
    expect(validatePhone('0912.345.678')).toBe(true);
    for (const raw of [
      '+84912345678',
      '912345678',
      '091234567',
      '012345678901',
      '',
      '   ',
      'abc',
    ]) {
      expect(validatePhone(raw), raw).toBe(false);
    }
  });
});

describe('validatePasswordInput', () => {
  it('tối thiểu 8 ký tự, tối đa 72 byte UTF-8', () => {
    expect(validatePasswordInput('1234567').ok).toBe(false);
    expect(validatePasswordInput('1234567').message).toContain('ít nhất 8 ký tự');
    expect(validatePasswordInput('12345678').ok).toBe(true);
    expect(validatePasswordInput('a'.repeat(72)).ok).toBe(true);
    expect(validatePasswordInput('a'.repeat(73)).ok).toBe(false);
    expect(validatePasswordInput('ế'.repeat(25)).ok).toBe(false); // 25 ký tự, 75 byte
    expect(validatePasswordInput('ế'.repeat(24)).ok).toBe(true); // 72 byte
    expect(validatePasswordInput('ế'.repeat(24) + 'a').message).toContain('72 byte');
  });
});

describe('validateFullName', () => {
  it('255 ký tự hợp lệ, 256 bị từ chối', () => {
    expect(validateFullName('a'.repeat(255))).toBe(true);
    expect(validateFullName('a'.repeat(256))).toBe(false);
  });
  it('chấp nhận tên có dấu, chặn chữ số/ký tự đặc biệt/độ dài sai', () => {
    expect(validateFullName('  Nguyễn   Thị Mai ')).toBe(true);
    for (const raw of ['', 'A', '=Mai', '1 Mai', 'Mai, Lan', '@abc'])
      expect(validateFullName(raw), raw).toBe(false);
  });
});

describe('edge cases', () => {
  it('phone: cắt khoảng trắng hai đầu; "0" sai', () => {
    expect(validatePhone(' 0912345678 ')).toBe(true);
    expect(validatePhone('0')).toBe(false);
  });
  it('tên: "Ab" hợp lệ, NFD được chuẩn hóa, có chữ số bị từ chối', () => {
    expect(validateFullName('Ab')).toBe(true);
    expect(validateFullName('Nguyễn'.normalize('NFD'))).toBe(true);
    expect(validateFullName('Mai 2')).toBe(false);
    // NFD 'ễ' = 3 code points: 254 + 3 = 257 > 255 unless normalized to NFC (1 code point)
    expect(validateFullName('a'.repeat(254) + 'ễ'.normalize('NFD'))).toBe(true);
  });
  it('mật khẩu 4 emoji (16 byte) rớt vì < 8 ký tự', () => {
    expect(validatePasswordInput('😀'.repeat(4)).ok).toBe(false);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    [' 0912345678 ', '0912345678'],
    ['091 234 5678', '0912345678'],
    ['0912.345.678', '0912345678'],
    ['0912-345-678', '0912345678'],
    ['\t0912 345\n678', '0912345678'],
    ['', ''],
    ['+84 912 345 678', '+84912345678'],
    ['abc', 'abc'],
    ['0'.repeat(32), '0'.repeat(32)],
    ['0'.repeat(33), ''],
    [' '.repeat(33) + '0912345678', ''], // raw length cap like the API (apps/api/src/lib/phone.ts)
  ])('%j -> %j', (raw, out) => expect(normalizePhone(raw)).toBe(out));
});

describe('normalizePhone non-strings', () => {
  it.each([[undefined], [null], [912345678], [{}]])('%j -> empty', (v) =>
    expect(normalizePhone(v as unknown as string)).toBe(''));
});

describe('phoneError (thông báo tiếng Việt từ client/authRules.js:validatePhone)', () => {
  it.each([
    ['', 'Vui lòng nhập số điện thoại.'],
    ['+84912345678', 'Không dùng định dạng +84. Hãy nhập số bắt đầu bằng 0, ví dụ 0912345678.'],
    ['09a2345678', 'Số điện thoại chỉ gồm chữ số.'],
    ['912345678', 'Số điện thoại phải bắt đầu bằng 0.'],
    ['091234567', 'Số điện thoại phải gồm 10-11 chữ số.'],
    ['0912345678', ''],
    ['091 234 5678', ''],
  ])('%j', (raw, msg) => expect(phoneError(raw)).toBe(msg));
});

describe('validateLoginForm', () => {
  it('báo từng ô rỗng; mật khẩu không bị cắt khoảng trắng', () => {
    expect(validateLoginForm({ phoneNumber: ' ', password: '' })).toEqual({
      phoneNumber: 'Vui lòng nhập số điện thoại.',
      password: 'Vui lòng nhập mật khẩu.',
    });
    expect(validateLoginForm({ phoneNumber: '0912345678', password: ' ' })).toEqual({});
  });
});

describe('validateRegisterForm', () => {
  const ok = { fullName: 'Hoàng Thị Tuyến', phoneNumber: '0912345678', password: '12345678', secretKey: '' };
  it('hợp lệ: không lỗi (học sinh không cần secretKey)', () => {
    expect(validateRegisterForm(ok, { isTeacher: false })).toEqual({});
  });
  it('báo lỗi từng ô', () => {
    const e = validateRegisterForm({ fullName: '', phoneNumber: '1', password: '1', secretKey: '' }, { isTeacher: true });
    expect(e['fullName']).toBe('Vui lòng nhập họ và tên.');
    expect(e['phoneNumber']).toBe('Số điện thoại phải bắt đầu bằng 0.');
    expect(e['password']).toContain('ít nhất 8 ký tự');
    expect(e['secretKey']).toBe('Vui lòng nhập mã bí mật giáo viên.');
  });
  it('tên chứa số bị từ chối; secretKey chỉ bắt buộc với giáo viên', () => {
    expect(validateRegisterForm({ ...ok, fullName: 'Mai 2' })['fullName']).toContain('không hợp lệ');
    expect(validateRegisterForm({ ...ok, secretKey: '  ' }, { isTeacher: true })['secretKey']).toBeDefined();
    expect(validateRegisterForm({ ...ok, secretKey: '  ' })['secretKey']).toBeUndefined();
  });
});

describe('validateChangePasswordForm', () => {
  it('đủ ba ô, mới khác cũ, nhập lại khớp', () => {
    expect(validateChangePasswordForm({ currentPassword: '', newPassword: '1', confirmPassword: '' })).toEqual({
      currentPassword: 'Vui lòng nhập mật khẩu hiện tại.',
      newPassword: 'Mật khẩu phải có ít nhất 8 ký tự.',
      confirmPassword: 'Vui lòng nhập lại mật khẩu mới.',
    });
    expect(
      validateChangePasswordForm({ currentPassword: '12345678', newPassword: '12345678', confirmPassword: '12345678' })['newPassword'],
    ).toBe('Mật khẩu mới phải khác mật khẩu hiện tại.');
    expect(
      validateChangePasswordForm({ currentPassword: 'abcdefgh', newPassword: '12345678', confirmPassword: '1234567x' })['confirmPassword'],
    ).toBe('Mật khẩu nhập lại không khớp.');
    expect(validateChangePasswordForm({ currentPassword: 'abcdefgh', newPassword: '12345678', confirmPassword: '12345678' })).toEqual({});
  });
});

describe('refreshErrors + ORDER', () => {
  it('chỉ giữ lỗi đang hiển thị mà vẫn còn sai; không thêm lỗi mới', () => {
    const prev = { phoneNumber: 'x', password: 'y' };
    expect(refreshErrors(prev, validateLoginForm, { phoneNumber: '0912345678', password: '' })).toEqual({ password: 'Vui lòng nhập mật khẩu.' });
    expect(refreshErrors({}, validateLoginForm, { phoneNumber: '', password: '' })).toEqual({});
  });
  it('thứ tự ô', () => {
    expect(LOGIN_ORDER).toEqual(['phoneNumber', 'password']);
    expect(REGISTER_ORDER).toEqual(['fullName', 'phoneNumber', 'password', 'secretKey']);
    expect(CHANGE_PASSWORD_ORDER).toEqual(['currentPassword', 'newPassword', 'confirmPassword']);
  });
});

describe('normalizeFullName', () => {
  it('NFC, cắt và gộp khoảng trắng', () => {
    expect(normalizeFullName('  Nguyễn   Văn\tA ')).toBe('Nguyễn Văn A');
    expect(normalizeFullName('Nguyễn'.normalize('NFD'))).toBe('Nguyễn');
    expect(normalizeFullName('')).toBe('');
  });
});
