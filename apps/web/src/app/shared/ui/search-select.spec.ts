// Created by Haihs on 15/11/2026
// Specs for the search-select pure helpers.
import { filterOptions, nextActiveIndex } from './search-select';

describe('search-select helpers', () => {
  const opts = [
    { key: '1', label: 'Lớp 10A1', hint: 'A101' },
    { key: '2', label: 'Lớp 11B2', hint: 'B202' },
  ];
  it('filters by label and hint, ignoring case', () => {
    expect(filterOptions(opts, 'lớp 11')).toHaveLength(1);
    expect(filterOptions(opts, 'a101')).toEqual([opts[0]]);
    expect(filterOptions(opts, '  ')).toEqual(opts);
  });
  it('moves the active row and skips disabled ones', () => {
    const disabled = (i: number) => i === 1;
    expect(nextActiveIndex('ArrowDown', 0, 3, disabled)).toBe(2);
    expect(nextActiveIndex('ArrowUp', 2, 3, disabled)).toBe(0);
    expect(nextActiveIndex('Home', 1, 3, disabled)).toBe(0);
    expect(nextActiveIndex('End', 0, 3)).toBe(2);
    expect(nextActiveIndex('ArrowDown', -1, 0)).toBe(-1);
  });
});
