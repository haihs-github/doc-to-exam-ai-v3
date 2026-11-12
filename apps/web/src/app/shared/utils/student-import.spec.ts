// Created by Haihs on 12/11/2026
// Specs for student import helpers (port of client/tests/studentImport.test.js).
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_XLSX_BYTES,
  buildPasswordCsv,
  studentTemplateCsv,
  validateImportFile,
} from './student-import';

const file = (name: string, size: number) => ({ name, size }) as File;

describe('validateImportFile', () => {
  it('constants: csv 256KB, xlsx 1MB', () => {
    expect(IMPORT_MAX_BYTES).toBe(256 * 1024);
    expect(IMPORT_MAX_XLSX_BYTES).toBe(1024 * 1024);
  });
  it('csv 256KB, xlsx 1MB, .xls và đuôi lạ bị từ chối', () => {
    expect(validateImportFile(file('a.xlsx', 10))).toEqual({ ok: true });
    expect(validateImportFile(file('A.XLSX', IMPORT_MAX_XLSX_BYTES)).ok).toBe(true);
    expect(validateImportFile(file('a.xlsx', IMPORT_MAX_XLSX_BYTES + 1))).toEqual({
      ok: false,
      message: 'File Excel vượt quá 1MB.',
    });
    expect(validateImportFile(file('a.csv', IMPORT_MAX_BYTES + 1))).toEqual({
      ok: false,
      message: 'File CSV vượt quá 256KB.',
    });
    expect(validateImportFile(file('DS.CSV', IMPORT_MAX_BYTES)).ok).toBe(true);
    expect(validateImportFile(file('a.xlsx', 0))).toEqual({ ok: false, message: 'File rỗng.' });
    expect(validateImportFile(file('a.csv', 0)).ok).toBe(false);
    const xls = validateImportFile(file('a.xls', 10));
    expect(xls.ok).toBe(false);
    expect(!xls.ok && xls.message).toMatch(/\.xlsx/);
    expect(validateImportFile(file('a.txt', 10)).ok).toBe(false);
    expect(validateImportFile(file('a.docx', 10)).ok).toBe(false);
  });
  it('thiếu file', () => {
    expect(validateImportFile(null)).toEqual({
      ok: false,
      message: 'Hãy chọn một file .csv hoặc .xlsx.',
    });
  });
});

describe('buildPasswordCsv', () => {
  it('chặn công thức trong tên/sdt, có BOM + header, nhãn trạng thái tiếng Việt', () => {
    const csv = buildPasswordCsv([
      {
        row: 1,
        status: 'created',
        fullName: '=cmd|x',
        phoneNumber: '0911111111',
        temporaryPassword: 'Ab3',
      },
    ]);
    expect(csv.split('\r\n')[1]).toBe('"\'=cmd|x","0911111111","Ab3","Đã tạo tài khoản"');
    expect(csv.startsWith('﻿"Họ và tên","Số điện thoại","Mật khẩu tạm","Trạng thái"')).toBe(true);
  });
  it('chỉ giữ dòng có mật khẩu tạm', () => {
    const csv = buildPasswordCsv([
      { row: 1, status: 'error', fullName: 'X', phoneNumber: '0900000000', message: 'sai' },
      { row: 2, status: 'alreadyMember', fullName: 'Y', phoneNumber: '0911111111' },
      {
        row: 3,
        status: 'created',
        fullName: 'Z',
        phoneNumber: '0922222222',
        temporaryPassword: 'pw',
      },
    ]);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});

describe('studentTemplateCsv', () => {
  it('header 2 cột và 2 dòng ví dụ', () => {
    const lines = studentTemplateCsv().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('﻿"Họ và tên","Số điện thoại"');
  });
});
