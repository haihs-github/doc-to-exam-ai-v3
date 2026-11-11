// Created by Haihs on 11/11/2026
// Tests for toProperName / toSearchKey (port of server/utils/textUtils.js).
import { describe, expect, it } from 'vitest';
import { toProperName, toSearchKey } from '../src/lib/textUtils';

describe('textUtils', () => {
  it('toProperName proper-cases Vietnamese names and collapses spaces', () => {
    expect(toProperName('  nGUYỄN   văn ánh ')).toBe('Nguyễn Văn Ánh');
  });
  it('toSearchKey strips accents, đ and lowercases', () => {
    expect(toSearchKey('Nguyễn Văn Ánh Đức')).toBe('nguyen van anh duc');
    expect(toSearchKey(undefined)).toBe('');
  });
});
