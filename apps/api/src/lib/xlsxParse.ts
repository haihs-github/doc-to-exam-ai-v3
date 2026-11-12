// Created by Haihs on 12/11/2026
// First sheet of an .xlsx as string rows (same shape as parseCsv), after a zip-bomb check. Port of server/utils/xlsxParse.js.
import { inflateRawSync } from 'node:zlib';
import { readSheet } from 'read-excel-file/node';

export const MAX_ENTRIES = 50;
export const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
const EOCD_SIG = 0x06054b50;
const CDIR_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const EOCD_MIN = 22;
const EOCD_SEARCH = EOCD_MIN + 0xffff; // EOCD + a comment of at most 65535 bytes
const CDIR_HEADER = 46;
const LOCAL_HEADER = 30;
const ZIP64_32 = 0xffffffff;
const ZIP64_16 = 0xffff;

/** Message is safe to show the user. */
export class XlsxError extends Error {}
const bad = (message: string) => new XlsxError(message);

/** `PK\x03\x04` */
export const hasZipMagic = (buf: Buffer): boolean =>
  buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

// The library has no cap on inflated bytes, so each entry is inflated here first with the remaining budget.
// shortcut: inflates twice (<= 10MB each, upload already capped at 1MB), skips unknown methods and ZIP64; hand the inflated buffer to the library if CPU matters.
function inflateWithin(buf: Buffer, cdirPos: number, budget: number): number {
  const method = buf.readUInt16LE(cdirPos + 10);
  const compSize = buf.readUInt32LE(cdirPos + 20);
  const local = buf.readUInt32LE(cdirPos + 42);
  if (local + LOCAL_HEADER > buf.length || buf.readUInt32LE(local) !== LOCAL_SIG)
    throw bad('File .xlsx bị hỏng.');
  const start = local + LOCAL_HEADER + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  if (start + compSize > buf.length) throw bad('File .xlsx bị hỏng.');
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return data.length;
  if (method !== 8) return 0;
  try {
    return inflateRawSync(data, { maxOutputLength: Math.max(budget, 1) }).length;
  } catch (err) {
    const e = err as { code?: string };
    throw bad(
      err instanceof RangeError || e.code === 'ERR_BUFFER_TOO_LARGE'
        ? 'File .xlsx giải nén quá lớn.'
        : 'File .xlsx bị hỏng.',
    );
  }
}

function assertZipSafe(buf: Buffer): void {
  const from = Math.max(0, buf.length - EOCD_SEARCH);
  let eocd = -1;
  for (let i = buf.length - EOCD_MIN; i >= from; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw bad('File .xlsx bị hỏng.');
  const entries = buf.readUInt16LE(eocd + 10);
  const dirSize = buf.readUInt32LE(eocd + 12);
  let pos = buf.readUInt32LE(eocd + 16);
  if (entries === ZIP64_16 || dirSize === ZIP64_32 || pos === ZIP64_32)
    throw bad('File .xlsx không được hỗ trợ.');
  if (entries > MAX_ENTRIES) throw bad('File .xlsx có quá nhiều thành phần.');
  let total = 0;
  let real = 0; // inflated bytes actually produced so far
  for (let n = 0; n < entries; n += 1) {
    if (pos + CDIR_HEADER > buf.length || buf.readUInt32LE(pos) !== CDIR_SIG)
      throw bad('File .xlsx bị hỏng.');
    const size = buf.readUInt32LE(pos + 24);
    if (size === ZIP64_32) throw bad('File .xlsx không được hỗ trợ.');
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw bad('File .xlsx giải nén quá lớn.');
    real += inflateWithin(buf, pos, MAX_UNCOMPRESSED_BYTES - real);
    pos +=
      CDIR_HEADER +
      buf.readUInt16LE(pos + 28) +
      buf.readUInt16LE(pos + 30) +
      buf.readUInt16LE(pos + 32);
  }
}

// Excel stores phones as numbers, dropping the leading 0 (912345678): a 9-10 digit integer gets its 0 back.
const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
    const s = String(v);
    return /^[1-9]\d{8,9}$/.test(s) ? `0${s}` : s;
  }
  return v instanceof Date ? '' : String(v);
};

/** Throws XlsxError (user-safe message) for a corrupt or oversized file. */
export async function parseXlsx(buf: Buffer): Promise<string[][]> {
  if (!hasZipMagic(buf)) throw bad('File không phải định dạng .xlsx.');
  assertZipSafe(buf);
  let rows: unknown[][];
  try {
    rows = (await readSheet(buf)) as unknown[][]; // first sheet
  } catch {
    throw bad('Không đọc được file .xlsx (file hỏng hoặc không đúng định dạng).');
  }
  return rows.map((row) => row.map(cellToString));
}
