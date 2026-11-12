// Created by Haihs on 12/11/2026
// Sitting lookup through the RAM cache (by id and by code) and the open/closed status derived from openAt/closeAt. Port of server/services/sittingLookup.js.
import { formatTimeSecondsDate } from '../lib/dateFormat';
import { examCache, readTtlMs } from '../lib/examCache';
import { ExamSittingModel } from '../models/ExamSitting';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const CODE_CACHE_PREFIX = 'code:';

/** Hand-typed code: upper-case, all whitespace removed. */
export const normalizeSittingCode = (code: unknown): string =>
  String(code ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();

export type CachedSitting = NonNullable<Awaited<ReturnType<typeof loadSitting>>>;
const loadSitting = (raw: string, isId: boolean, code: string) =>
  (isId ? ExamSittingModel.findById(raw) : ExamSittingModel.findOne({ code })).lean();

/**
 * Frozen lean sitting by id or code, remembered for a short TTL; every write on ExamSitting clears the cache.
 * NOT for teacher flows that need a document to write.
 */
export async function findSittingCached(idOrCode: unknown): Promise<CachedSitting | null> {
  const raw = typeof idOrCode === 'string' ? idOrCode.trim() : String(idOrCode ?? '').trim();
  if (!raw) return null;
  const isId = OBJECT_ID_PATTERN.test(raw);
  const code = normalizeSittingCode(raw);
  const cacheKey = isId ? raw.toLowerCase() : `${CODE_CACHE_PREFIX}${code}`;
  const ttlMs = readTtlMs();
  const hit = ttlMs > 0 ? examCache.get<CachedSitting>(cacheKey) : null;
  if (hit) return hit;
  const generation = examCache.getGeneration(); // a clear() in between means this read must not be cached
  const sitting = await loadSitting(raw, isId, code);
  if (!sitting) return null; // "not found" is never remembered
  examCache.set(
    [String(sitting._id), `${CODE_CACHE_PREFIX}${sitting.code}`],
    sitting,
    ttlMs,
    generation,
  );
  return sitting;
}

export type SittingStatus = 'not_started' | 'open' | 'ended';
/** now < openAt: not started; now >= closeAt: ended; otherwise open. */
export function getSittingAvailability(
  sitting: { openAt?: Date | null; closeAt?: Date | null } | null | undefined,
  now = new Date(),
): { open: boolean; status: SittingStatus; message: string } {
  const open = sitting?.openAt;
  const close = sitting?.closeAt;
  if (
    Number.isNaN(new Date(open ?? NaN).getTime()) ||
    Number.isNaN(new Date(close ?? NaN).getTime())
  )
    return { open: false, status: 'ended', message: 'Ca thi chưa có giờ mở/đóng hợp lệ.' };
  if (now < (open as Date))
    return {
      open: false,
      status: 'not_started',
      message: `Ca thi chưa mở. Giờ mở ca là: ${formatTimeSecondsDate(open)}.`,
    };
  if (now >= (close as Date))
    return {
      open: false,
      status: 'ended',
      message: `Ca thi đã kết thúc vào lúc: ${formatTimeSecondsDate(close)}.`,
    };
  return { open: true, status: 'open', message: 'Ca thi đang mở.' };
}
