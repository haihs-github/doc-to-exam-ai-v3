// Created by Haihs on 11/11/2026
// Tests for validateMaxLength/clampText/exceedsLimit (port of client/tests/limits.test.js).
import { exceedsLimit, validateMaxLength, clampText, LIMITS } from './limits';

describe('limits', () => {
  it('constants match source (limits.js:5-9)', () => {
    expect(LIMITS).toEqual({
      TITLE_MAX: 255, DESCRIPTION_MAX: 255, FULL_NAME_MAX: 255, CLASS_NAME_MAX: 100, CLASS_CODE_MAX: 30,
    });
  });

  it('validateMaxLength: 255 qua, 300 báo lỗi nêu giới hạn và độ dài hiện tại', () => {
    expect(validateMaxLength('a'.repeat(255), 'TITLE_MAX', 'Tên đề mẫu')).toBe('');
    expect(validateMaxLength('a'.repeat(300), 'TITLE_MAX', 'Tên đề mẫu')).toBe('Tên đề mẫu tối đa 255 ký tự (hiện 300).');
    expect(validateMaxLength(undefined, 'TITLE_MAX', 'X')).toBe('');
    expect(exceedsLimit('a'.repeat(31), 'CLASS_CODE_MAX')).toBe(true);
    expect(() => validateMaxLength('x', 'NOPE' as never, 'X')).toThrow();
  });

  it('clampText', () => {
    expect(clampText('abc', 5)).toBe('abc');
    expect(clampText('abcdef', 4)).toBe('abc…');
    expect(clampText(null, 4)).toBe('');
  });
});
