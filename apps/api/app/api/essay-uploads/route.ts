// Created by Haihs on 12/11/2026
// POST /api/essay-uploads?questionId=: one essay file (.txt/.docx/.jpg/.png/.webp/.pdf) of a running session. Auth = X-Upload-Token (session) + the shared JWT check (tokenVersion, mustChangePassword) that must match the session's student. Source: essayUploadRoutes.js.
import { ok } from '../../../src/lib/apiResponse';
import { authenticateRequest } from '../../../src/lib/auth';
import { detectEssayFile, sanitizeFileName } from '../../../src/lib/essaySniff';
import { loadEssayUploadConfig } from '../../../src/lib/essayUploadConfig';
import { isEssayQuestion, type Question } from '../../../src/lib/examValidation';
import { readCapped } from '../../../src/lib/fileSniff';
import { HttpError, withErrors } from '../../../src/lib/handler';
import { LIMITERS } from '../../../src/lib/limiters';
import { withRateLimit } from '../../../src/lib/rateLimit';
import { SittingSessionModel } from '../../../src/models/SittingSession';
import {
  createSemaphore,
  extractEssayText,
  forgetUploadToken,
  isUploadTokenKnown,
  rememberUploadToken,
  saveUpload,
} from '../../../src/services/essayUploads';
import { findSittingCached } from '../../../src/services/sittingLookup';

export const runtime = 'nodejs';

const SESSION_GRACE_MS = 120 * 1000;
const TOKEN_PATTERN = /^[0-9a-f]{48}$/;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MB = 1024 * 1024;

const config = loadEssayUploadConfig();
// Next may bundle the route more than once: one semaphore per process on globalThis.
const g = globalThis as { __essaySemaphore?: ReturnType<typeof createSemaphore> };
const semaphore = (g.__essaySemaphore ??= createSemaphore(config.concurrency));

const busy = () =>
  new HttpError('busy', 'Hệ thống đang nhận nhiều tệp cùng lúc. Vui lòng thử lại sau vài giây.');

async function handle(req: Request): Promise<Response> {
  if (semaphore.isFull()) throw busy(); // before any DB work
  const token = req.headers.get('x-upload-token') ?? '';
  if (!TOKEN_PATTERN.test(token))
    throw new HttpError('no_session', 'Thiếu hoặc sai mã phiên làm bài. Hãy vào lại phòng thi.');
  const session = await SittingSessionModel.findOne({ uploadToken: token });
  if (!session || Date.now() > session.deadlineAt.getTime() + SESSION_GRACE_MS) {
    forgetUploadToken(token);
    throw new HttpError(
      'session_invalid',
      'Phiên làm bài không còn hiệu lực (đã nộp bài hoặc hết giờ).',
    );
  }
  // the SAME authentication as every other route (tokenVersion, mustChangePassword): the upload route must not be a way around it
  let user;
  try {
    user = await authenticateRequest(req);
  } catch (e) {
    if (e instanceof HttpError && e.code === 'UNAUTHENTICATED')
      throw new HttpError(
        'unauthenticated',
        'Thiếu hoặc sai thông tin đăng nhập. Hãy đăng nhập lại.',
      );
    throw e;
  }
  if (String(user._id) !== String(session.studentId))
    throw new HttpError('wrong_student', 'Phiên làm bài không thuộc tài khoản của bạn.');
  if (!isUploadTokenKnown(token)) rememberUploadToken(token);

  const questionId = Number(new URL(req.url).searchParams.get('questionId'));
  const sitting = Number.isInteger(questionId)
    ? await findSittingCached(String(session.sittingId))
    : null;
  if (
    !sitting ||
    !(sitting.questions as unknown as Question[]).some(
      (q) => q.id === questionId && isEssayQuestion(q),
    )
  )
    throw new HttpError('invalid_question', 'Câu hỏi không phải câu tự luận của đề này.');

  const tooLarge = () =>
    new HttpError(
      'too_large',
      `Tệp quá lớn (tối đa ${Math.floor(config.mediaMaxBytes / MB)}MB cho ảnh/PDF).`,
    );
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > config.mediaMaxBytes + MULTIPART_OVERHEAD_BYTES)
    throw tooLarge();

  const release = semaphore.tryAcquire();
  if (!release) throw busy();
  try {
    // body cap read early, and a timeout only for RECEIVING the body (not for processing)
    let body: Buffer;
    try {
      body = await Promise.race([
        readCapped(req, config.mediaMaxBytes + MULTIPART_OVERHEAD_BYTES, 'too large'),
        new Promise<never>((_, rej) =>
          setTimeout(
            () => rej(new HttpError('body_timeout', 'Tải tệp quá chậm, vui lòng thử lại.')),
            config.bodyTimeoutMs,
          ).unref(),
        ),
      ]);
    } catch (e) {
      if (e instanceof HttpError && e.code === 'PAYLOAD_TOO_LARGE') throw tooLarge();
      throw e;
    }
    const type = req.headers.get('content-type') ?? '';
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(body), {
        headers: { 'content-type': type },
      }).formData();
    } catch {
      throw new HttpError('bad_upload', 'Yêu cầu tải tệp không hợp lệ.');
    }
    const files = form.getAll('file');
    if (files.length > 1) throw new HttpError('too_many_files', 'Chỉ được tải lên đúng một tệp.');
    const file = files[0];
    if (!file || typeof file === 'string')
      throw new HttpError('no_file', 'Chưa chọn tệp để tải lên.');
    const fileName = sanitizeFileName(file.name);
    let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());
    const detected = detectEssayFile(buffer, fileName, config);
    if (detected.kind === 'text' && buffer.length > config.textMaxBytes)
      throw new HttpError(
        'too_large',
        `Tệp .txt/.docx quá lớn (tối đa ${Math.floor(config.textMaxBytes / MB)}MB).`,
      );
    let saved;
    if (detected.kind === 'text') {
      const text = await extractEssayText(buffer, detected.format, config);
      buffer = null; // extracted: drop the buffer at once
      saved = await saveUpload(
        { session, questionId, detected, fileName, text, size: text.length },
        config,
      );
    } else {
      const size = buffer.length;
      saved = await saveUpload({ session, questionId, detected, fileName, buffer, size }, config);
    }
    return ok(
      {
        uploadId: saved.uploadId,
        questionId,
        kind: saved.kind,
        fileName: saved.fileName,
        mime: saved.mime,
        ...(saved.kind === 'media'
          ? { size: saved.mediaSize }
          : { extractedChars: saved.extractedChars }),
      },
      { status: 201 },
    );
  } finally {
    release();
  }
}

// Failed attempts (4xx) count against the bad-token bucket per IP; the per-session bucket stops a runaway client.
export const POST = withErrors(
  withRateLimit(
    [LIMITERS.ESSAY_UPLOAD_BAD, LIMITERS.ESSAY_UPLOAD_IP, LIMITERS.ESSAY_UPLOAD_SESSION],
    handle,
  ),
);
