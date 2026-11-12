// Created by Haihs on 12/11/2026
// Essay-upload limits read from the environment (size caps, semaphore, rate limits, retention). Port of server/config/essayUpload.js.
import { MAX_ESSAY_CHARS } from './examValidation';

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const readNumber = (
  raw: string | undefined,
  fallback: number,
  { min = 0, max = Number.MAX_SAFE_INTEGER } = {},
): number => {
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const v = Number(raw);
  return !Number.isFinite(v) || v < min || v > max ? fallback : v;
};

/** Defaults from the design (D5/Q17): txt/docx <= 2MB, media <= 3MB, total media <= 250MB, semaphore 3, keep 7 days after grading, 30-day safety TTL, unsubmitted uploads 24h. */
export function loadEssayUploadConfig(source: Record<string, string | undefined> = process.env) {
  return {
    textMaxBytes: Math.floor(readNumber(source.ESSAY_UPLOAD_TEXT_MAX_BYTES, 2 * MB, { min: 1 })),
    mediaMaxBytes: Math.floor(readNumber(source.ESSAY_UPLOAD_MEDIA_MAX_BYTES, 3 * MB, { min: 1 })),
    maxChars: MAX_ESSAY_CHARS,
    mediaTotalMaxBytes: Math.floor(
      readNumber(source.ESSAY_MEDIA_TOTAL_MAX_BYTES, 250 * MB, { min: 1 }),
    ),
    concurrency: Math.floor(readNumber(source.ESSAY_UPLOAD_CONCURRENCY, 3, { min: 1, max: 20 })),
    retryAfterSeconds: Math.floor(
      readNumber(source.ESSAY_UPLOAD_RETRY_AFTER_SECONDS, 3, { min: 1, max: 120 }),
    ),
    orphanTtlMs:
      readNumber(source.ESSAY_UPLOAD_ORPHAN_TTL_HOURS, 24, { min: 0.01 }) * 60 * 60 * 1000,
    mediaSafetyTtlMs: readNumber(source.ESSAY_MEDIA_SAFETY_TTL_DAYS, 30, { min: 1 }) * DAY_MS,
    mediaRetentionMs: readNumber(source.ESSAY_MEDIA_RETENTION_DAYS, 7, { min: 0.001 }) * DAY_MS,
    docxMaxUncompressedBytes: Math.floor(
      readNumber(source.ESSAY_DOCX_MAX_UNCOMPRESSED_BYTES, 10 * MB, { min: 1 }),
    ),
    docxMaxDocumentXmlBytes: Math.floor(
      readNumber(source.ESSAY_DOCX_MAX_DOCUMENT_XML_BYTES, 3 * MB, { min: 1 }),
    ),
    docxMaxRatio: readNumber(source.ESSAY_DOCX_MAX_RATIO, 100, { min: 1 }),
    bodyTimeoutMs: readNumber(source.ESSAY_UPLOAD_BODY_TIMEOUT_MS, 90 * 1000, { min: 1 }),
    docxMaxEntries: Math.floor(readNumber(source.ESSAY_DOCX_MAX_ENTRIES, 500, { min: 1 })),
    extractTimeoutMs: readNumber(source.ESSAY_EXTRACT_TIMEOUT_MS, 10 * 1000, { min: 1 }),
  };
}
export type EssayUploadConfig = ReturnType<typeof loadEssayUploadConfig>;
