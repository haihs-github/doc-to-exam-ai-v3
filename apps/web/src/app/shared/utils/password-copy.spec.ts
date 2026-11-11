// Created by Haihs on 12/11/2026
// Specs for buildPasswordCopyText (port of client/tests/passwordCopy.test.js).
import { buildPasswordCopyText } from './password-copy';

describe('buildPasswordCopyText', () => {
  it('một dòng: chỉ mật khẩu, không tên/SĐT', () => {
    expect(
      buildPasswordCopyText([{ fullName: 'An', phoneNumber: '0901', temporaryPassword: 'Abc123' }]),
    ).toBe('Abc123');
  });
  it('nhiều dòng nối bằng \n; rỗng thì chuỗi rỗng', () => {
    expect(buildPasswordCopyText([{ temporaryPassword: 'a' }, { temporaryPassword: 'b' }])).toBe(
      'a\nb',
    );
    expect(buildPasswordCopyText(undefined)).toBe('');
  });
});
