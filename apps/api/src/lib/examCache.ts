// Created by Haihs on 12/11/2026
// Short-TTL in-RAM cache of sittings (plain frozen objects) for the student hot paths; any write on ExamSitting clears it. Port of server/utils/examCache.js (single instance, decision D9).

const DEFAULT_TTL_MS = 20 * 1000;
const MAX_ENTRIES = 200;

/** EXAM_CACHE_TTL_MS: 0 turns the cache off. Read at call time so tests can change it. */
export function readTtlMs(source: Record<string, string | undefined> = process.env): number {
  const raw = source.EXAM_CACHE_TTL_MS;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_TTL_MS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TTL_MS;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype) return value; // ObjectId, Date...: leave alone
  Object.freeze(value);
  Object.values(value as object).forEach(deepFreeze);
  return value;
}

export function createExamCache({ now = () => Date.now(), maxEntries = MAX_ENTRIES } = {}) {
  let generation = 0; // bumped by clear(): a read that began before a write must not be cached afterwards
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    get<T = unknown>(key: string): T | null {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value as T;
    },
    getGeneration: () => generation,
    set(keys: string[], value: unknown, ttlMs: number, expectedGeneration = generation): void {
      if (ttlMs <= 0 || expectedGeneration !== generation) return;
      const expiresAt = now() + ttlMs;
      for (const key of keys) {
        entries.delete(key);
        entries.set(key, { value: deepFreeze(value), expiresAt });
      }
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
    clear(): void {
      generation += 1;
      entries.clear();
    },
    size: () => entries.size,
  };
}

// Next may bundle this module once per route: share one cache on globalThis so clear() reaches every route.
const g = globalThis as { __examCache?: ReturnType<typeof createExamCache> };
export const examCache = (g.__examCache ??= createExamCache());
