// Created by Haihs on 12/11/2026
// Specs for class UI helpers (error messages, restore-code validation, school-year label).
import {
  describeClassError,
  formatSchoolYear,
  isClassCodeTaken,
  validateRestoreCode,
} from './class-ui';

const apiErr = (code: string, message = 'server msg', status = 400) => ({
  success: false,
  code,
  message,
  status,
});

describe('class-ui', () => {
  it('formats the school year', () => expect(formatSchoolYear(2023, 2026)).toBe('2023-2026'));

  it('recognises CLASS_CODE_TAKEN only', () => {
    expect(isClassCodeTaken(apiErr('CLASS_CODE_TAKEN', 'x', 409))).toBe(true);
    expect(isClassCodeTaken(apiErr('CONFLICT', 'x', 409))).toBe(false);
    expect(isClassCodeTaken(new Error('boom'))).toBe(false);
    expect(isClassCodeTaken(null)).toBe(false);
  });

  it('maps known class codes to Vietnamese, keeps the fallback for non-API errors', () => {
    expect(describeClassError(apiErr('LAST_TEACHER'), 'f')).toBe(
      'Lớp phải còn ít nhất một giáo viên: hãy thêm giáo viên khác hoặc xóa lớp.',
    );
    expect(describeClassError(apiErr('NOT_FOUND'), 'f')).toContain('Không tìm thấy lớp');
    expect(describeClassError(new Error('stack trace'), 'Không xóa được lớp.')).toBe(
      'Không xóa được lớp.',
    );
  });

  it('rate limit / busy go through the generic message, not the code table', () => {
    expect(describeClassError(apiErr('NOT_FOUND', 'm', 429), 'f')).toContain('quá nhiều lần');
  });

  it('unknown API code uses the server message', () =>
    expect(describeClassError(apiErr('VALIDATION', 'Tên sai'), 'f')).toBe('Tên sai'));

  it('validateRestoreCode: trims, upper-cases, rejects empty / too long', () => {
    expect(validateRestoreCode('  10a1 ')).toEqual({ ok: true, code: '10A1' });
    expect(validateRestoreCode('   ')).toEqual({ ok: false, error: 'Hãy nhập mã lớp mới.' });
    expect(validateRestoreCode('x'.repeat(31))).toEqual({
      ok: false,
      error: 'Mã lớp tối đa 30 ký tự.',
    });
  });
});
