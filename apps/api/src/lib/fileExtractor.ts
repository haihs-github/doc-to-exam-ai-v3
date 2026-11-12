// Created by Haihs on 12/11/2026
// Text from a PDF / Word / txt upload. Word keeps <u>, <strong>, <em>, <del> (the AI needs underlines). Port of server/utils/fileExtractor.js.
import { extname } from 'node:path';
import { HttpError } from './handler';

const unreadable = () =>
  new HttpError(
    'VALIDATION',
    'Không đọc được nội dung tệp, có thể tệp bị hỏng. Hãy thử xuất lại tệp.',
  );

// shortcut: any error from pdf-parse/mammoth counts as a corrupt file; classify when out-of-memory etc. must be told apart
async function readOrUnreadable<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error('Cannot read file content:', err);
    throw unreadable();
  }
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimetype = '',
  originalname = '',
): Promise<string> {
  const mime = String(mimetype ?? '').toLowerCase();
  const ext = extname(String(originalname ?? ''))
    .toLowerCase()
    .replace('.', '');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new HttpError('VALIDATION', 'Tệp tải lên rỗng hoặc không đọc được.');

  if (mime === 'application/pdf' || ext === 'pdf') {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    return (await readOrUnreadable(() => pdfParse(buffer))).text;
  }
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword' ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    const mammoth = (await import('mammoth')).default;
    try {
      const result = await mammoth.convertToHtml(
        { buffer },
        { styleMap: ['u => u', 'b => strong', 'i => em', 'strike => del'] },
      );
      if (result.value && result.value.trim().length > 0) return result.value;
    } catch (err) {
      console.warn('Word to HTML failed, falling back to raw text:', (err as Error).message);
    }
    return (await readOrUnreadable(() => mammoth.extractRawText({ buffer }))).value;
  }
  if (mime.startsWith('text/') || ext === 'txt') return buffer.toString('utf-8');
  throw new HttpError(
    'VALIDATION',
    `Định dạng tệp không được hỗ trợ (${mime || ext || 'không xác định'}). Vui lòng tải lên file PDF hoặc DOC/DOCX.`,
  );
}
