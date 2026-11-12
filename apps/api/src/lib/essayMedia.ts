// Created by Haihs on 12/11/2026
// Serves a stored essay photo/PDF inline with safe headers; missing / expired / unknown MIME -> 410 MEDIA_GONE. The download name is set by the server. Port of sendEssayMedia in sittingResultsController.js.
import { fail } from './apiResponse';

const SERVABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function sendEssayMedia(
  media: { data?: Buffer | { buffer?: ArrayBufferLike }; mime: string } | null,
  submissionId: unknown,
  questionId: number,
  goneMessage = 'Tệp gốc đã quá thời hạn lưu hoặc không còn tồn tại.',
): Response {
  if (!media || !media.data || !SERVABLE.has(media.mime)) return fail('MEDIA_GONE', goneMessage);
  const bytes = Buffer.isBuffer(media.data)
    ? media.data
    : Buffer.from((media.data as { buffer: ArrayBufferLike }).buffer);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': media.mime,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="essay-${submissionId}-q${questionId}.${EXT[media.mime]}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  });
}
