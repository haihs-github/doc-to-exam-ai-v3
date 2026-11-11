// Created by Haihs on 11/11/2026
// Specs for pure auth input rules (ported from client/tests/authRules.test.js).
import { validatePhone, validatePasswordInput, validateFullName } from './auth-rules';

describe('validatePhone', () => {
  it('nhận 10-11 chữ số bắt đầu bằng 0', () => {
    expect(validatePhone('0912345678')).toBe(true);
    expect(validatePhone('01234567890')).toBe(true);
  });
  it('từ chối +84, khoảng trắng/dấu chấm, thiếu số 0, sai độ dài, rỗng', () => {
    for (const raw of [
      '+84912345678',
      '091 234 5678',
      '0912.345.678',
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
