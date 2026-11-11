// Created by Haihs on 12/11/2026
// Specs for toCsvCell/buildCsv: RFC 4180 escaping and formula-injection guard (port of client/tests/csv.test.js, studentImport.test.js).
import { buildCsv, toCsvCell } from './csv';

describe('csv', () => {
  it('toCsvCell escape dấu nháy kép và bọc nháy kép', () => {
    expect(toCsvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(toCsvCell(null)).toBe('""');
    expect(toCsvCell(undefined)).toBe('""');
    expect(toCsvCell('a,b\nc')).toBe('"a,b\nc"');
  });

  it('thêm dấu nháy đơn trước ô bắt đầu bằng = + - @ tab CR (chống formula injection)', () => {
    expect(toCsvCell('=HYPERLINK("http://x","a")')).toBe('"\'=HYPERLINK(""http://x"",""a"")"');
    expect(toCsvCell('+84901234567')).toBe('"\'+84901234567"');
    expect(toCsvCell('-2+3')).toBe('"\'-2+3"');
    expect(toCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(toCsvCell('\t=1+1')).toBe('"\'\t=1+1"');
    expect(toCsvCell('\r=1+1')).toBe('"\'\r=1+1"');
    expect(toCsvCell('  =1+1')).toBe('"\'  =1+1"');
    for (const v of ['=1+1', '+1', '-1', '@A', '\t1', '\r1']) expect(toCsvCell(v)).toBe(`"'${v}"`);
  });

  it('ký tự khoảng trắng/điều khiển/định dạng vô hình đứng trước công thức vẫn bị chặn', () => {
    for (const v of [
      ' =1',
      '\u0000=1',
      '\u0001+1',
      '\u001f@x',
      ' \t -1',
      '\u007f=1',
      '​=1',
      '­+1',
      '‮-1',
      '᠎@x',
    ]) {
      expect(toCsvCell(v)).toBe(`"'${v}"`);
    }
  });

  it('không đụng chuỗi bình thường và số thật (kể cả số âm)', () => {
    expect(toCsvCell('Nguyễn Văn A')).toBe('"Nguyễn Văn A"');
    expect(toCsvCell('a=b')).toBe('"a=b"');
    expect(toCsvCell('0912345678')).toBe('"0912345678"');
    expect(toCsvCell(7.5)).toBe('"7.5"');
    expect(toCsvCell(-1)).toBe('"-1"');
    expect(toCsvCell(-3)).toBe('"-3"');
    expect(toCsvCell(0)).toBe('"0"');
  });

  it('buildCsv có BOM, CRLF, escape từng ô, tiếng Việt', () => {
    expect(buildCsv(['A', 'B'], [['=1', 2]])).toBe('﻿"A","B"\r\n"\'=1","2"');
    expect(
      buildCsv(
        ['Họ và tên', 'Ghi chú'],
        [
          ['Nguyễn Văn "A"', ''],
          ['Trần Thị B', null],
        ],
      ),
    ).toBe('﻿"Họ và tên","Ghi chú"\r\n"Nguyễn Văn ""A""",""\r\n"Trần Thị B",""');
  });
});
