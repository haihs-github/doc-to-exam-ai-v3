// Created by Haihs on 11/11/2026
// Tests for errorMessage. Source client/tests has no apiErrors test; cases derive from describeApiError (client/src/utils/apiErrors.js:23-30).
import { errorMessage } from './api-errors';

const fail = (code: string, message: string, extra: object = {}) => ({ success: false, code, message, ...extra });

describe('errorMessage', () => {
  it('mất kết nối (status 0) -> thông báo mạng (apiErrors.js:24)', () => {
    expect(errorMessage(fail('INTERNAL', 'x', { status: 0 }))).toBe('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  });

  it('RATE_LIMITED -> quá nhiều lần, kèm giây chờ từ Retry-After (apiErrors.js:26)', () => {
    expect(errorMessage(fail('RATE_LIMITED', 'x'))).toBe('Bạn thao tác quá nhiều lần.');
    expect(errorMessage(fail('RATE_LIMITED', 'x', { status: 429, retryAfter: '3' }))).toBe(
      'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau khoảng 3 giây.');
  });

  it('503 -> hệ thống bận (apiErrors.js:27)', () => {
    expect(errorMessage(fail('INTERNAL', 'x', { status: 503 }))).toBe('Hệ thống đang bận.');
  });

  it('lỗi hợp đồng khác -> message của server (apiErrors.js:28)', () => {
    expect(errorMessage(fail('NOT_FOUND', 'Không tìm thấy lớp'))).toBe('Không tìm thấy lớp');
  });

  it('không phải lỗi hợp đồng -> fallback, không lộ chi tiết nội bộ (apiErrors.js:21)', () => {
    const generic = 'Có lỗi xảy ra. Vui lòng thử lại!';
    expect(errorMessage(new Error('stack boom'))).toBe(generic);
    expect(errorMessage(null)).toBe(generic);
    expect(errorMessage('x')).toBe(generic);
  });
});
