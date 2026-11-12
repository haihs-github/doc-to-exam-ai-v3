// Created by Haihs on 12/11/2026
// POST /api/templates/parse (multipart "file": .pdf/.doc/.docx/.txt <= 20MB): extract text, ask Gemini, return the questions (nothing is saved).
import { extname } from 'node:path';
import { ok } from '../../../../src/lib/apiResponse';
import { withApiKey, withPermission } from '../../../../src/lib/auth';
import { extractTextFromFile } from '../../../../src/lib/fileExtractor';
import { readCapped } from '../../../../src/lib/fileSniff';
import { parseExamWithGemini } from '../../../../src/lib/geminiParser';
import { HttpError, withErrors } from '../../../../src/lib/handler';
import { LIMITERS } from '../../../../src/lib/limiters';
import { withRateLimit } from '../../../../src/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 120; // AI calls can take a while on a hosted runtime

const MAX_BYTES = 20 * 1024 * 1024;
const MULTIPART_OVERHEAD = 64 * 1024;
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.txt'];
const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Order as in the source: permission, upload limiter (by user), API key, then the body is read (a blocked request is never buffered).
export const POST = withErrors(
  withPermission(
    'template:parse',
    withRateLimit(
      [LIMITERS.TEACHER_UPLOAD],
      withApiKey(async (req, ctx) => {
        const type = req.headers.get('content-type') ?? '';
        if (!/^multipart\/form-data;/i.test(type))
          throw new HttpError(
            'VALIDATION',
            'Vui lòng chọn tệp đề thi (PDF hoặc DOC/DOCX) để tải lên.',
          );
        const body = await readCapped(req, MAX_BYTES + MULTIPART_OVERHEAD, 'Tệp vượt quá 20MB.');
        let form: FormData;
        try {
          form = await new Response(new Uint8Array(body), {
            headers: { 'content-type': type },
          }).formData();
        } catch {
          throw new HttpError(
            'VALIDATION',
            'Vui lòng chọn tệp đề thi (PDF hoặc DOC/DOCX) để tải lên.',
          );
        }
        const files = form.getAll('file');
        const file = files.length === 1 && typeof files[0] !== 'string' ? files[0] : null;
        if (!file)
          throw new HttpError(
            'VALIDATION',
            'Vui lòng chọn tệp đề thi (PDF hoặc DOC/DOCX) để tải lên.',
          );
        const ext = extname(file.name || '').toLowerCase();
        if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(file.type))
          throw new HttpError(
            'VALIDATION',
            'Định dạng tệp không được hỗ trợ. Vui lòng tải lên file PDF (.pdf) hoặc Word (.doc, .docx).',
          );
        if (file.size > MAX_BYTES) throw new HttpError('PAYLOAD_TOO_LARGE', 'Tệp vượt quá 20MB.');
        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await extractTextFromFile(buffer, file.type, file.name);
        if (!text || text.trim().length === 0)
          throw new HttpError(
            'VALIDATION',
            'Không thể trích xuất văn bản từ tệp này. Tệp có thể rỗng hoặc là file scan dạng ảnh.',
          );
        const apiKey = ctx.user.geminiApiKey.trim(); // withApiKey already checked it is not empty
        const parsed = await parseExamWithGemini(apiKey, text, file.name, buffer, file.type);
        return ok(parsed, { message: 'Phân tích đề thi thành công!' });
      }),
    ),
  ),
);
