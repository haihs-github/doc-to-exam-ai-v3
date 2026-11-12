// Created by Haihs on 12/11/2026
// Tests for the M2 class error codes (HTTP status table) and class DTO types.
import { describe, expect, it } from 'vitest';
import { HTTP_STATUS, type ClassDto, type ErrorCode } from '../src/index';

describe('contract class error codes', () => {
  it.each([
    ['INVITE_INVALID', 404],
    ['CLASS_CODE_TAKEN', 409],
    ['STUDENT_NOT_FOUND', 404],
    ['TEACHER_NOT_FOUND', 404],
    ['CLASS_NOT_ACCEPTING', 409],
    ['LAST_TEACHER', 409],
    ['CSV_INVALID', 422],
    ['CSV_TOO_MANY_ROWS', 422],
  ] as [ErrorCode, number][])('%s -> %i', (code, status) => {
    expect(HTTP_STATUS[code]).toBe(status);
  });

  it('ClassDto shape compiles', () => {
    const c: ClassDto = {
      id: '1',
      name: 'A',
      code: 'A1',
      startYear: 2025,
      endYear: 2026,
      status: 'active',
      studentCount: 0,
      teacherCount: 1,
    };
    expect(c.status).toBe('active');
  });
});
