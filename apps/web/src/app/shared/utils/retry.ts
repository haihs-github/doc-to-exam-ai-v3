// Created by Haihs on 11/11/2026
// Exponential backoff + jitter honouring Retry-After; port of client/src/utils/retry.js.
// Errors are ApiFailure-shaped ({status, retryAfter}, see core/api-client.ts) instead of axios {response}; status 0 = network failure.

export const RETRYABLE_STATUSES = [408, 429, 503]; // retry.js:6
const MAX_RETRY_AFTER_MS = 60 * 1000; // retry.js:7

// retry.js:16 - seconds or HTTP date to ms, capped so a server cannot stall the client.
export const parseRetryAfterMs = (value: unknown, nowMs = Date.now()): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  let ms: number | null = null;
  if (/^\d+(\.\d+)?$/.test(text)) {
    ms = Number(text) * 1000;
  } else {
    const date = Date.parse(text);
    if (!Number.isNaN(date)) ms = date - nowMs;
  }
  if (ms === null || !Number.isFinite(ms)) return null;
  return Math.min(Math.max(0, ms), MAX_RETRY_AFTER_MS);
};

// retry.js:41 - jitter 50-100%; with Retry-After wait at least that plus up to 50% extra jitter.
export const computeBackoffDelayMs = ({
  attempt, baseMs = 1500, maxMs = 20000, retryAfterMs = null, random = Math.random,
}: { attempt: number; baseMs?: number; maxMs?: number; retryAfterMs?: number | null; random?: () => number }): number => {
  const exponent = Math.max(0, Number(attempt) - 1);
  const ceiling = Math.min(maxMs, baseMs * 2 ** exponent);
  const jittered = ceiling * (0.5 + 0.5 * random());
  if (retryAfterMs !== null && retryAfterMs !== undefined) {
    return Math.round(Math.max(retryAfterMs, jittered) + random() * retryAfterMs * 0.5);
  }
  return Math.round(jittered);
};

type Failure = { status?: number; retryAfter?: string | null; code?: string; name?: string } | null | undefined;

// retry.js:55 - no response (status 0 / unknown error) or 408/429/503 retry; explicit cancel does not.
export const isRetryableError = (error: unknown): boolean => {
  const e = error as Failure;
  if (!e || e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError') return false;
  if (e.status === undefined || e.status === 0) return true;
  return RETRYABLE_STATUSES.includes(e.status);
};

// retry.js:63 - header already captured as `retryAfter` by ApiClient.
export const getRetryAfterFromError = (error: unknown, nowMs = Date.now()): number | null =>
  parseRetryAfterMs((error as Failure)?.retryAfter, nowMs);

// retry.js:68
const defaultSleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const canceled = () => Object.assign(new Error('Đã hủy'), { code: 'ERR_CANCELED' });
  if (signal?.aborted) {
    reject(canceled());
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    reject(canceled());
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export interface RetryOptions {
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  random?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

// retry.js:92
export const retryWithBackoff = async <T>(task: (attempt: number) => Promise<T>, {
  maxAttempts = 6, baseMs, maxMs, random = Math.random, sleep = defaultSleep, signal, onRetry,
}: RetryOptions = {}): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) throw error;
      const delayMs = computeBackoffDelayMs({
        attempt, baseMs, maxMs, retryAfterMs: getRetryAfterFromError(error), random,
      });
      if (onRetry) onRetry({ attempt, delayMs, error });
      await sleep(delayMs, signal);
    }
  }
};
