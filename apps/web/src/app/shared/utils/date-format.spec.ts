// Created by Haihs on 11/11/2026
// Tests for UTC+7 date formatting (port of client/tests/dateFormat.test.js; formatVn is the new alias of formatDateTime).
import { formatDate, formatDateTime, formatTimeSecondsDate, formatDateParts, formatVn } from './date-format';

describe('date-format', () => {
  it('nửa đêm UTC+7 và zero-pad', () => {
    const v = '2026-11-03T17:00:00Z'; // 00:00 04/11 giờ VN
    expect(formatDateTime(v)).toBe('04/11/2026 00:00');
    expect(formatVn(v)).toBe('04/11/2026 00:00');
    expect(formatDate(v)).toBe('04/11/2026');
    expect(formatTimeSecondsDate('2026-01-02T03:04:05Z')).toBe('10:04:05 02/01/2026');
  });

  it('31/12 UTC sang 01/01 qua UTC+7', () => {
    expect(formatDateTime('2026-12-31T17:00:00Z')).toBe('01/01/2027 00:00');
    expect(formatDateTime('2026-12-31T16:59:00Z')).toBe('31/12/2026 23:59');
  });

  it('năm nhuận và tháng 2', () => {
    expect(formatDate('2028-02-28T17:00:00Z')).toBe('29/02/2028');
    expect(formatDate('2027-02-28T17:00:00Z')).toBe('01/03/2027');
  });

  it('formatDateParts tách ngày và giờ', () => {
    expect(formatDateParts(new Date('2026-11-04T05:09:00Z'))).toEqual({ date: '04/11/2026', time: '12:09' });
  });

  it('rỗng/không hợp lệ -> chuỗi rỗng', () => {
    for (const bad of [null, undefined, '', 'abc', new Date('x'), NaN]) {
      expect(formatDate(bad)).toBe('');
      expect(formatDateTime(bad)).toBe('');
      expect(formatVn(bad as never)).toBe('');
      expect(formatTimeSecondsDate(bad)).toBe('');
      expect(formatDateParts(bad)).toEqual({ date: '', time: '' });
    }
  });

  it('không phụ thuộc múi giờ tiến trình', () => {
    expect(formatDateTime(0)).toBe('01/01/1970 07:00');
  });
});
