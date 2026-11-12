// Created by Haihs on 12/11/2026
// Student import helpers: client-side file check, template CSV, temp-password CSV; port of studentImport.js.
import type { ImportResultRow } from '@doc-to-exam/contract';
import { buildCsv } from './csv';

export const IMPORT_MAX_BYTES = 256 * 1024; // .csv, matches server
export const IMPORT_MAX_XLSX_BYTES = 1024 * 1024; // .xlsx, matches server

export const IMPORT_STATUS_LABELS: Record<ImportResultRow['status'], string> = {
  created: 'Đã tạo tài khoản',
  added: 'Đã thêm vào lớp',
  alreadyMember: 'Đã ở trong lớp',
  error: 'Lỗi',
};

export type FileCheck = { ok: true } | { ok: false; message: string };

/** Quick client check (the server decides): a file, .csv <=256KB or .xlsx <=1MB, not empty. */
export function validateImportFile(
  file: Pick<File, 'name' | 'size'> | null | undefined,
): FileCheck {
  if (!file) return { ok: false, message: 'Hãy chọn một file .csv hoặc .xlsx.' };
  const name = file.name || '';
  if (/\.xls$/i.test(name)) {
    return { ok: false, message: 'Chưa hỗ trợ file .xls cũ, hãy lưu lại thành .xlsx hoặc .csv.' };
  }
  const isXlsx = /\.xlsx$/i.test(name);
  if (!isXlsx && !/\.csv$/i.test(name))
    return { ok: false, message: 'Chỉ nhận file có đuôi .csv hoặc .xlsx.' };
  if (!(file.size > 0)) return { ok: false, message: 'File rỗng.' };
  if (file.size > (isXlsx ? IMPORT_MAX_XLSX_BYTES : IMPORT_MAX_BYTES)) {
    return { ok: false, message: isXlsx ? 'File Excel vượt quá 1MB.' : 'File CSV vượt quá 256KB.' };
  }
  return { ok: true };
}

/** CSV of the rows that carry a temporary password (only newly created students). */
export function buildPasswordCsv(rows: ImportResultRow[]): string {
  return buildCsv(
    ['Họ và tên', 'Số điện thoại', 'Mật khẩu tạm', 'Trạng thái'],
    rows
      .filter((r) => r.temporaryPassword)
      .map((r) => [
        r.fullName,
        r.phoneNumber,
        r.temporaryPassword,
        IMPORT_STATUS_LABELS[r.status] ?? r.status,
      ]),
  );
}

/** Header + 2 example rows; the server recognises the phone column by name. */
export const studentTemplateCsv = (): string =>
  buildCsv(
    ['Họ và tên', 'Số điện thoại'],
    [
      ['Nguyễn Văn An', '0912345678'],
      ['Trần Thị Bình', '0987654321'],
    ],
  );
