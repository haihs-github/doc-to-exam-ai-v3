// Created by Haihs on 12/11/2026
// Tests for the shared phone normaliser (moved from apps/api and apps/web).
import { describe, expect, it } from 'vitest';
import { normalizePhone, PHONE_RE } from '../src/index';

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '0912345678'],
    [' 0912 345.678-9 ', '09123456789'],
    ['\t0912 345\n678', '0912345678'],
    ['', ''],
    ['+84 912 345 678', '+84912345678'],
    ['0'.repeat(32), '0'.repeat(32)],
    ['0'.repeat(33), ''],
    [' '.repeat(33) + '0912345678', ''],
  ])('%j -> %j', (raw, out) => expect(normalizePhone(raw)).toBe(out));

  it.each([123, null, undefined, {}, []])('non-string %j -> empty', (v) =>
    expect(normalizePhone(v)).toBe(''),
  );

  it('PHONE_RE accepts 10-11 digits starting with 0 only', () => {
    expect(PHONE_RE.test('0912345678')).toBe(true);
    expect(PHONE_RE.test('09123456789')).toBe(true);
    expect(PHONE_RE.test('912345678')).toBe(false);
    expect(PHONE_RE.test('091234567')).toBe(false);
  });
});
