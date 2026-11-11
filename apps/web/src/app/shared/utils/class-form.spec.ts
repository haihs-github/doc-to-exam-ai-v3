// Created by Haihs on 12/11/2026
// Specs for validateClassForm/upperClassCode (port of client/tests/classRules.test.js validateClassForm + validateSchoolYear cases).
import { upperClassCode, validateClassForm } from './class-form';

const ok = { name: 'LỚP 10A1', code: 'A1', startYear: '2023', endYear: '2026' };

describe('validateClassForm', () => {
  it('hợp lệ -> map rỗng (chuỗi hoặc số)', () => {
    expect(validateClassForm(ok)).toEqual({});
    expect(validateClassForm({ name: 'a', code: 'b', startYear: 2023, endYear: 2024 })).toEqual({});
    expect(validateClassForm({ name: 'a', code: 'b', startYear: 2023, endYear: 2035 })).toEqual({});
  });

  it('thiếu tên/mã/năm -> lỗi đúng ô theo thứ tự', () => {
    const e = validateClassForm({ name: ' ', code: '', startYear: '', endYear: 'abc' });
    expect(Object.keys(e)).toEqual(['name', 'code', 'startYear', 'endYear']);
    expect(e.name).toBe('Vui lòng nhập tên lớp.');
    expect(e.code).toBe('Vui lòng nhập mã lớp.');
    expect(e.startYear).toBe('Năm bắt đầu phải là số nguyên.');
    expect(e.endYear).toBe('Năm kết thúc phải là số nguyên.');
  });

  it('tên 100 qua, 101 lỗi; mã 30 qua, 31 lỗi, nêu giới hạn', () => {
    expect(validateClassForm({ ...ok, name: 'x'.repeat(100), code: 'y'.repeat(30) })).toEqual({});
    const e = validateClassForm({ ...ok, name: 'x'.repeat(101), code: 'y'.repeat(31) });
    expect(e.name).toMatch(/100/);
    expect(e.code).toMatch(/30/);
  });

  it('niên khóa: start 2000-2100, span 1-12; sai khoảng gắn endYear', () => {
    expect(validateClassForm({ ...ok, startYear: 2023, endYear: 2023 }).endYear).toMatch(
      /1 đến 12/,
    );
    expect(validateClassForm({ ...ok, startYear: 2023, endYear: 2036 }).endYear).toMatch(
      /1 đến 12/,
    );
    expect(validateClassForm({ ...ok, startYear: 2023, endYear: 2020 }).endYear).toMatch(
      /1 đến 12/,
    );
    expect(validateClassForm({ ...ok, startYear: 1999, endYear: 2003 }).startYear).toMatch(/2000/);
    expect(validateClassForm({ ...ok, startYear: 2101, endYear: 2103 }).startYear).toMatch(/2100/);
    expect(validateClassForm({ ...ok, startYear: 2100, endYear: 2112 })).toEqual({});
    expect(validateClassForm({ ...ok, startYear: 2023.5, endYear: 2026 }).startYear).toMatch(
      /số nguyên/,
    );
    expect(
      validateClassForm({ ...ok, startYear: null, endYear: undefined } as never).startYear,
    ).toMatch(/số nguyên/);
  });
});

describe('upperClassCode', () => {
  it('in hoa kể cả tiếng Việt', () => {
    expect(upperClassCode('a1 ư')).toBe('A1 Ư');
  });
});
