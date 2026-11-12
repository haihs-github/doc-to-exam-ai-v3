// Created by Haihs on 12/11/2026
// Import upload checks: capped body read BEFORE multipart parsing, extension + magic bytes. Port of readCsvFile in studentAdminController.js.
import { HttpError } from './handler';
import { hasZipMagic } from './xlsxParse';

export const CSV_MAX_BYTES = 256 * 1024;
export const XLSX_MAX_BYTES = 1024 * 1024;
const MULTIPART_OVERHEAD = 16 * 1024; // boundaries and part headers around the file

export type ImportKind = 'csv' | 'xlsx';

const TOO_BIG: Record<ImportKind, string> = {
  csv: 'File CSV vượt quá 256KB.',
  xlsx: 'File Excel vượt quá 1MB.',
};

/** Reads the request body but stops (and cancels the stream) as soon as it passes the cap: formData() would buffer it all. */
export async function readCapped(req: Request, maxBytes: number, message: string): Promise<Buffer> {
  const tooLarge = () => new HttpError('PAYLOAD_TOO_LARGE', message);
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const badUpload = (message: string, status = 422) =>
  new HttpError('CSV_INVALID', message, { status });

/** Returns the uploaded file (single field "file") after all size / type checks. */
export async function readImportFile(
  req: Request,
): Promise<{ buffer: Buffer; kind: ImportKind; name: string }> {
  const type = req.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data;/i.test(type))
    throw badUpload('Yêu cầu tải file không hợp lệ (cần đúng một file ở trường "file").', 400);
  const body = await readCapped(req, XLSX_MAX_BYTES + MULTIPART_OVERHEAD, TOO_BIG.xlsx);
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(body), {
      headers: { 'content-type': type },
    }).formData();
  } catch {
    throw badUpload('Yêu cầu tải file không hợp lệ (cần đúng một file ở trường "file").', 400);
  }
  const files = form.getAll('file');
  if (files.length !== 1 || typeof files[0] === 'string')
    throw badUpload('Thiếu file CSV (trường "file").', 400);
  const file = files[0];
  const name = file.name || '';
  const kind: ImportKind | null = /\.csv$/i.test(name)
    ? 'csv'
    : /\.xlsx$/i.test(name)
      ? 'xlsx'
      : null;
  if (!kind)
    throw badUpload(
      /\.xls$/i.test(name)
        ? 'Không hỗ trợ file .xls, hãy lưu lại thành .xlsx hoặc CSV.'
        : 'Chỉ nhận file .csv hoặc .xlsx.',
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  if (kind === 'csv' && buffer.length > CSV_MAX_BYTES)
    throw new HttpError('PAYLOAD_TOO_LARGE', TOO_BIG.csv);
  if (buffer.length > XLSX_MAX_BYTES) throw new HttpError('PAYLOAD_TOO_LARGE', TOO_BIG.xlsx);
  if (kind === 'csv' ? buffer.includes(0) : !hasZipMagic(buffer))
    throw badUpload(kind === 'csv' ? 'File CSV không hợp lệ.' : 'File không phải định dạng .xlsx.');
  return { buffer, kind, name };
}
