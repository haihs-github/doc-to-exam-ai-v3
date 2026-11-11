// Created by Haihs on 12/11/2026
// Tests for toUpperVi.
import { describe, expect, it } from 'vitest';
import { toUpperVi } from '../src/lib/vnText';

describe('toUpperVi', () => {
  it('trims, NFC-normalises and upper-cases Vietnamese', () => {
    expect(toUpperVi('  lớp đặc biệt ')).toBe('LỚP ĐẶC BIỆT');
    expect(toUpperVi('á')).toBe('Á'); // decomposed input
  });
});
