// Created by Haihs on 12/11/2026
// Essay upload use cases: concurrency gate, known-token memory, text extraction, saving uploads/media, resolving them at submit, attaching and retention. Port of server/services/essayUploadService.js.
import { randomBytes } from 'node:crypto';
import type { ErrorCode } from '@doc-to-exam/contract';
import type { Types } from 'mongoose';
import { sanitizeEssayAnswers, isEssayQuestion, type Question } from '../lib/examValidation';
import { decodeTextFile, type DetectedEssayFile } from '../lib/essaySniff';
import type { EssayUploadConfig } from '../lib/essayUploadConfig';
import { HttpError } from '../lib/handler';
import { EssayMediaModel } from '../models/EssayMedia';
import { EssayUploadModel, type IEssayUpload } from '../models/EssayUpload';
import type { IEssayAnswer } from '../models/SittingSubmission';

export const UPLOAD_ID_PATTERN = /^[0-9a-f]{32}$/;
const err = (status: number, code: ErrorCode, message: string) =>
  new HttpError(code, message, { status });

/** Queue-less semaphore: when full, refuse at once (503) instead of holding the request/body in RAM. */
export function createSemaphore(limit: number) {
  let active = 0;
  return {
    tryAcquire(): (() => void) | null {
      if (active >= limit) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
    getActive: () => active,
    isFull: () => active >= limit, // checked before any DB query
  };
}

// "Known good" upload tokens in RAM (10 min, max 5000): fewer DB lookups, and an authenticated student is not blocked by the bad-token limiter. Single instance (D9).
const KNOWN_TOKEN_TTL_MS = 10 * 60 * 1000;
const KNOWN_TOKEN_MAX = 5000;
const knownTokens = new Map<string, number>();
export function rememberUploadToken(token: string): void {
  knownTokens.delete(token); // re-insert: newest last
  knownTokens.set(token, Date.now() + KNOWN_TOKEN_TTL_MS);
  while (knownTokens.size > KNOWN_TOKEN_MAX)
    knownTokens.delete(knownTokens.keys().next().value as string);
}
export const forgetUploadToken = (token: string): void => void knownTokens.delete(token);
export const isUploadTokenKnown = (token: string): boolean =>
  (knownTokens.get(token) ?? 0) > Date.now();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(err(422, 'extract_timeout', 'Xử lý tệp quá lâu, vui lòng thử tệp khác.')),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Text of a .txt/.docx, cut at the character cap. The caller must drop the buffer afterwards. */
export async function extractEssayText(
  buffer: Buffer,
  format: 'txt' | 'docx' | 'image' | 'pdf',
  { maxChars, extractTimeoutMs }: Pick<EssayUploadConfig, 'maxChars' | 'extractTimeoutMs'>,
): Promise<string> {
  let text: string;
  if (format === 'docx') {
    try {
      const mammoth = (await import('mammoth')).default;
      text = (await withTimeout(mammoth.extractRawText({ buffer }), extractTimeoutMs)).value;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw err(422, 'docx_unreadable', 'Không đọc được nội dung tệp Word (.docx).');
    }
  } else text = decodeTextFile(buffer);
  text = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxChars);
  if (!text) throw err(422, 'empty_text', 'Tệp không có nội dung văn bản để chấm.');
  return text;
}

// Estimated total media bytes, adjusted incrementally. TTL/deletes only make the REAL size smaller than the counter, so it is never below the truth
// (single instance); an exact aggregate is needed only near the cap (and the first time), so the cap can never be exceeded.
const mediaUsage: { bytes: number | null } = { bytes: null };
export const resetMediaUsageCounter = (): void => {
  mediaUsage.bytes = null;
};
async function getMediaBytesInUse(a: {
  sessionId: Types.ObjectId;
  questionId: number;
  size: number;
  maxBytes: number;
}): Promise<number> {
  if (mediaUsage.bytes !== null && mediaUsage.bytes + a.size <= a.maxBytes) return mediaUsage.bytes; // fast path: 0 Mongo commands
  const rows = await EssayUploadModel.aggregate<{ total: number; replaced: number }>([
    { $match: { kind: 'media' } },
    {
      $group: {
        _id: null,
        total: { $sum: '$mediaSize' },
        replaced: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$sessionId', a.sessionId] },
                  { $eq: ['$questionId', a.questionId] },
                ],
              },
              '$mediaSize',
              0,
            ],
          },
        },
      },
    },
  ]);
  mediaUsage.bytes = rows[0]?.total ?? 0;
  return (rows[0]?.total ?? 0) - (rows[0]?.replaced ?? 0);
}

const newUploadId = (): string => randomBytes(16).toString('hex');

/**
 * Saves one validated upload. One essayUploads document per (session, question) (unique index): a new upload OVERWRITES it by one
 * atomic upsert keeping the uploadId, then the replaced media is deleted. Media is created BEFORE overwriting and removed again on failure (no orphans).
 */
export async function saveUpload(
  p: {
    session: { _id: Types.ObjectId; sittingId: Types.ObjectId; studentId: Types.ObjectId };
    questionId: number;
    detected: DetectedEssayFile;
    fileName: string;
    buffer?: Buffer;
    text?: string;
    size: number;
  },
  config: EssayUploadConfig,
) {
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + config.orphanTtlMs);
  let mediaId: Types.ObjectId | null = null;
  if (p.detected.kind === 'media') {
    const used = await getMediaBytesInUse({
      sessionId: p.session._id,
      questionId: p.questionId,
      size: p.size,
      maxBytes: config.mediaTotalMaxBytes,
    });
    if (used + p.size > config.mediaTotalMaxBytes)
      throw err(
        422,
        'media_storage_full',
        'Kho lưu ảnh/PDF của hệ thống đã đầy. Hãy nộp bài dạng văn bản (.txt/.docx) hoặc báo giáo viên.',
      );
    const media = await EssayMediaModel.create({
      data: p.buffer,
      mime: p.detected.mime,
      size: p.size,
      fileName: p.fileName,
      sittingId: p.session.sittingId,
      questionId: p.questionId,
      expiresAt,
    });
    mediaId = media._id;
  }
  const isText = p.detected.kind === 'text';
  const fields = {
    sittingId: p.session.sittingId,
    studentId: p.session.studentId,
    kind: p.detected.kind,
    text: isText ? (p.text ?? '') : '',
    fileName: p.fileName,
    mime: p.detected.mime,
    extractedChars: isText ? (p.text ?? '').length : 0,
    mediaId,
    mediaSize: isText ? 0 : p.size,
    submissionId: null,
    createdAt: new Date(nowMs),
    expiresAt,
  };
  const filter = { sessionId: p.session._id, questionId: p.questionId };
  const insertedUploadId = newUploadId();
  const update = { $set: fields, $setOnInsert: { uploadId: insertedUploadId } };
  let previous: IEssayUpload | null;
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        previous = await EssayUploadModel.findOneAndUpdate(filter, update, {
          upsert: true,
          returnDocument: 'before',
          lean: true,
        });
        break;
      } catch (e) {
        if ((e as { code?: unknown }).code === 11000 && attempt < 3) continue; // two parallel upserts
        throw e;
      }
    }
  } catch (e) {
    if (mediaId) await EssayMediaModel.deleteOne({ _id: mediaId }).catch(() => {});
    throw e;
  }
  if (!isText && mediaUsage.bytes !== null) mediaUsage.bytes += p.size - (previous?.mediaSize ?? 0);
  if (previous?.mediaId) {
    try {
      await EssayMediaModel.deleteOne({ _id: previous.mediaId });
    } catch (e) {
      console.error(
        'Cannot remove the replaced media (ignored, the TTL will):',
        (e as Error).message,
      );
    }
  }
  return {
    uploadId: previous?.uploadId ?? insertedUploadId,
    kind: fields.kind,
    fileName: fields.fileName,
    mime: fields.mime,
    mediaSize: fields.mediaSize,
    extractedChars: fields.extractedChars,
  };
}

type LeanUpload = IEssayUpload & { _id: Types.ObjectId };

/**
 * Normalises essayAnswers of /submit. Each question takes a string or { text?, uploadId? }; a valid uploadId makes the file replace the text.
 * - uploadId no longer exists (expired, overwritten): drop the file, keep the text if any, warn 'upload_lost', so mcq answers are never lost (e.g. auto-submit as the upload expired).
 * - malformed uploadId, or someone else's / another sitting's / another question's / already attached: 400 (an honest client never hits it).
 */
export async function resolveEssayAnswers(
  rawEssayAnswers: unknown,
  questions: Question[],
  who: { sittingId: Types.ObjectId; studentId: Types.ObjectId },
): Promise<{
  essayAnswers: Partial<IEssayAnswer>[];
  attachments: LeanUpload[];
  warnings: string[];
}> {
  const raw = (
    rawEssayAnswers && typeof rawEssayAnswers === 'object' ? rawEssayAnswers : {}
  ) as Record<string, unknown>;
  const essayIds = new Set(questions.filter(isEssayQuestion).map((q) => String(q.id)));
  const textOnly: Record<string, string> = {};
  const wanted: { questionId: number; uploadId: unknown }[] = [];
  for (const key of Object.keys(raw)) {
    if (!essayIds.has(String(key))) continue;
    const value = raw[key];
    if (typeof value === 'string') textOnly[key] = value;
    else if (value && typeof value === 'object') {
      const v = value as { text?: unknown; uploadId?: unknown };
      if (typeof v.text === 'string') textOnly[key] = v.text;
      if (v.uploadId !== undefined && v.uploadId !== null && v.uploadId !== '')
        wanted.push({ questionId: Number(key), uploadId: v.uploadId });
    }
  }
  const attachments: LeanUpload[] = [];
  const fromUploads: Partial<IEssayAnswer>[] = [];
  const warnings: string[] = [];
  for (const { questionId, uploadId } of wanted) {
    if (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId))
      throw new HttpError('INVALID_UPLOAD', 'Mã tệp tải lên (uploadId) không hợp lệ.');
    const upload = (await EssayUploadModel.findOne({ uploadId }).lean()) as LeanUpload | null;
    if (!upload) {
      if (!warnings.includes('upload_lost')) warnings.push('upload_lost');
      continue;
    }
    const mine =
      String(upload.sittingId) === String(who.sittingId) &&
      String(upload.studentId) === String(who.studentId) &&
      upload.questionId === questionId &&
      !upload.submissionId;
    if (!mine) throw new HttpError('INVALID_UPLOAD', 'Tệp tải lên không thuộc bài làm của bạn.');
    delete textOnly[String(questionId)]; // the file replaces the text
    attachments.push(upload);
    fromUploads.push(
      upload.kind === 'media'
        ? {
            questionId,
            text: '',
            source: 'file-media',
            fileName: upload.fileName,
            fileMime: upload.mime,
            extractedChars: 0,
            mediaRef: upload.mediaId,
          }
        : {
            questionId,
            text: upload.text,
            source: 'file-text',
            fileName: upload.fileName,
            fileMime: upload.mime,
            extractedChars: upload.extractedChars,
          },
    );
  }
  return {
    essayAnswers: [...sanitizeEssayAnswers(textOnly, questions), ...fromUploads],
    attachments,
    warnings,
  };
}

/** After the submission is saved: attach media (safety TTL = createdAt + 30 days) and drop the intermediate text uploads, in at most 2 bulk writes. */
export async function attachUploadsToSubmission(
  submissionId: Types.ObjectId,
  attachments: LeanUpload[],
  config: Pick<EssayUploadConfig, 'mediaSafetyTtlMs'>,
): Promise<void> {
  const mediaOps = [];
  const uploadOps = [];
  for (const upload of attachments) {
    if (upload.kind === 'media') {
      const expiresAt = new Date(new Date(upload.createdAt).getTime() + config.mediaSafetyTtlMs);
      mediaOps.push({
        updateOne: {
          filter: { _id: upload.mediaId },
          update: { $set: { submissionId, expiresAt, attached: true } },
        },
      });
      uploadOps.push({
        updateOne: { filter: { _id: upload._id }, update: { $set: { submissionId, expiresAt } } },
      });
    } else uploadOps.push({ deleteOne: { filter: { _id: upload._id } } });
  }
  if (mediaOps.length > 0) await EssayMediaModel.bulkWrite(mediaOps, { ordered: false });
  if (uploadOps.length > 0) await EssayUploadModel.bulkWrite(uploadOps, { ordered: false });
}

/** After a manual grade: keep the media a further `retention`, then the TTL deletes it (the teacher can still look and re-grade meanwhile). */
export async function scheduleMediaRetention(
  submissionId: Types.ObjectId,
  questionId: number,
  config: Pick<EssayUploadConfig, 'mediaRetentionMs'>,
): Promise<void> {
  const expiresAt = new Date(Date.now() + config.mediaRetentionMs);
  await EssayMediaModel.updateMany({ submissionId, questionId }, { $set: { expiresAt } });
  await EssayUploadModel.updateMany(
    { submissionId, questionId, kind: 'media' },
    { $set: { expiresAt } },
  );
}
// shortcut: sweepUnattachedMedia / healMediaAttachment of the source are not ported (the source never schedules them either; only the Mongo TTL cleans); add them if attach failures show up in the logs.
