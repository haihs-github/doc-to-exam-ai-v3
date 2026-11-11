// Created by Haihs on 11/11/2026
// Tests for the shared error contract (HTTP status table and isApiError guard).
import { describe, expect, it } from 'vitest';
import { HTTP_STATUS, isApiError, type ErrorCode } from '../src/index';

describe('contract errors', () => {
  it('isApiError accepts a valid error body', () => {
    expect(isApiError({ success: false, code: 'NOT_FOUND', message: 'x' })).toBe(true);
  });
  it('isApiError rejects ok bodies and null', () => {
    expect(isApiError({ success: true })).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
  it('maps statuses', () => {
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.MUST_CHANGE_PASSWORD).toBe(403);
    expect(HTTP_STATUS.REQUIRE_API_KEY).toBe(400);
  });
  it('every ErrorCode has a status', () => {
    const codes: ErrorCode[] = [
      'VALIDATION',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'PAYLOAD_TOO_LARGE',
      'MUST_CHANGE_PASSWORD',
      'REQUIRE_API_KEY',
      'INTERNAL',
    ];
    for (const c of codes) expect(typeof HTTP_STATUS[c]).toBe('number');
  });
});
