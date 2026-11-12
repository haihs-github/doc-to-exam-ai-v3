// Created by Haihs on 11/11/2026
// Tests for the auth error codes and auth DTO types of the shared contract.
import { describe, expect, it } from 'vitest';
import { HTTP_STATUS, type AuthResult, type ErrorCode } from '../src/index';

describe('contract auth', () => {
  it.each([
    ['INVALID_CREDENTIALS', 401],
    ['PHONE_TAKEN', 409],
    ['SECRET_KEY_INVALID', 403],
    ['SERVER_BUSY', 503],
  ] as [ErrorCode, number][])('%s -> %i', (code, status) => {
    expect(HTTP_STATUS[code]).toBe(status);
  });
  it('AuthResult shape compiles', () => {
    const r: AuthResult = {
      token: 't',
      user: {
        id: '1',
        phoneNumber: '0900000000',
        fullName: 'A',
        role: 'teacher',
        mustChangePassword: false,
      },
    };
    expect(r.user.role).toBe('teacher');
  });
});
