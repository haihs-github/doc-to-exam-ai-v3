// Created by Haihs on 12/11/2026
// Essay file type by MAGIC BYTES (never trust the extension or the client MIME) and docx zip safety checks. Port of the essay part of server/utils/fileSniff.js.
import { extname } from 'node:path';
import { HttpError } from './handler';
import type { ErrorCode } from '@doc-to-exam/contract';
import type { EssayUploadConfig } from './essayUploadConfig';

type Media = { mime: string; test: (b: Buffer) => boolean };
const jpeg = (b: Buffer) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const MEDIA_TYPES: Record<string, Media> = {
  jpg: { mime: 'image/jpeg', test: jpeg },
  jpeg: { mime: 'image/jpeg', test: jpeg },
  png: {
    mime: 'image/png',
    test: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  webp: {
    mime: 'image/webp',
    test: (b) =>
      b.length >= 12 &&
      b.toString('latin1', 0, 4) === 'RIFF' &&
      b.toString('latin1', 8, 12) === 'WEBP',
  },
  pdf: {
    mime: 'application/pdf',
    test: (b) => b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-',
  },
};
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIME = 'text/plain';
const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

const err = (status: number, code: ErrorCode, message: string) =>
  new HttpError(code, message, { status });

/** iPhone photos (HEIC/HEIF) are recognised by the `ftyp` box even when renamed. */
const looksLikeHeic = (b: Buffer): boolean =>
  b.length >= 12 &&
  b.toString('latin1', 4, 8) === 'ftyp' &&
  HEIC_BRANDS.has(b.toString('latin1', 8, 12));
export const extensionOf = (name: unknown): string =>
  extname(String(name ?? ''))
    .toLowerCase()
    .replace('.', '');

/** Reads the zip central directory (no inflating) to refuse zip bombs that declare huge sizes. null = not a valid zip. */
export function inspectZip(buf: Buffer) {
  const minEocd = 22;
  if (buf.length < minEocd) return null;
  let eocd = -1;
  for (let i = buf.length - minEocd; i >= Math.max(0, buf.length - minEocd - 0xffff); i -= 1)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return null;
  const total = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const inf = {
    entries: Infinity,
    totalUncompressed: Infinity,
    hasDocumentXml: false,
    documentXmlSize: Infinity,
    maxRatio: Infinity,
  };
  if (total === 0xffff || offset === 0xffffffff) return inf; // zip64: refused
  let totalUncompressed = 0;
  let hasDocumentXml = false;
  let documentXmlSize = 0;
  let maxRatio = 0;
  for (let i = 0; i < total; i += 1) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;
    const uncompressed = buf.readUInt32LE(offset + 24);
    const compressed = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > buf.length) return null;
    if (buf.toString('latin1', offset + 46, offset + 46 + nameLength) === 'word/document.xml') {
      hasDocumentXml = true;
      documentXmlSize = uncompressed === 0xffffffff ? Infinity : uncompressed;
    }
    if (uncompressed > 1024 * 1024)
      maxRatio = Math.max(maxRatio, compressed === 0 ? Infinity : uncompressed / compressed);
    totalUncompressed += uncompressed === 0xffffffff ? Infinity : uncompressed;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { entries: total, totalUncompressed, hasDocumentXml, documentXmlSize, maxRatio };
}

export type DetectedEssayFile = {
  kind: 'text' | 'media';
  format: 'txt' | 'docx' | 'image' | 'pdf';
  mime: string;
};

/** The extension only declares intent: the CONTENT must match it. Throws an HttpError with a detailed 415 code. */
export function detectEssayFile(
  buffer: Buffer,
  fileName: string,
  limits: EssayUploadConfig,
): DetectedEssayFile {
  const ext = extensionOf(fileName);
  if (HEIC_EXTENSIONS.has(ext) || looksLikeHeic(buffer))
    throw err(
      415,
      'heic_not_supported',
      'Không nhận ảnh HEIC/HEIF (ảnh iPhone). Hãy chụp/lưu ảnh dạng JPEG hoặc PNG rồi tải lên lại.',
    );
  const media = MEDIA_TYPES[ext];
  if (media) {
    if (!media.test(buffer))
      throw err(
        415,
        'content_mismatch',
        'Nội dung tệp không khớp với đuôi tệp (tệp bị đổi đuôi hoặc hỏng).',
      );
    return { kind: 'media', format: ext === 'pdf' ? 'pdf' : 'image', mime: media.mime };
  }
  if (ext === 'docx') {
    const isZip = buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
    const info = isZip ? inspectZip(buffer) : null;
    if (!info || !info.hasDocumentXml)
      throw err(415, 'content_mismatch', 'Tệp không phải tài liệu Word (.docx) hợp lệ.');
    if (
      info.entries > limits.docxMaxEntries ||
      info.totalUncompressed > limits.docxMaxUncompressedBytes ||
      info.documentXmlSize > limits.docxMaxDocumentXmlBytes ||
      info.maxRatio > limits.docxMaxRatio
    )
      throw err(
        415,
        'docx_too_complex',
        'Tệp Word quá phức tạp hoặc nén bất thường, không thể xử lý.',
      );
    return { kind: 'text', format: 'docx', mime: DOCX_MIME };
  }
  if (ext === 'txt') return { kind: 'text', format: 'txt', mime: TXT_MIME };
  throw err(415, 'unsupported_type', 'Chỉ nhận tệp .txt, .docx, .jpg, .png, .webp hoặc .pdf.');
}

/** .txt as UTF-8 (a BOM is accepted); binary or non-UTF-8 content is refused. */
export function decodeTextFile(buffer: Buffer): string {
  if (buffer.includes(0))
    throw err(415, 'content_mismatch', 'Tệp .txt chứa dữ liệu nhị phân, không phải văn bản.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw err(415, 'text_encoding', 'Tệp .txt phải được lưu bằng mã hóa UTF-8.');
  }
}

/** File name to store/show: no path, no control characters, cut short. */
export const sanitizeFileName = (fileName: unknown): string =>
  (
    String(fileName ?? '')
      .replace(/\\/g, '/')
      .split('/')
      .pop() ?? ''
  )
    // eslint-disable-next-line no-control-regex -- control characters are stripped on purpose
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
