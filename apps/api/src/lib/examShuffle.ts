// Created by Haihs on 12/11/2026
// Context-aware shuffling of questions and options. Port of server/utils/examShuffle.js.
import { isEssayQuestion } from './examValidation';

type Q = { id: number; context?: string; options?: Record<string, string> };

/** Fisher-Yates. */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Consecutive questions with the same context (reading passage / instruction) form one block; consecutive context-less ones form one block. */
export function partitionIntoBlocks<T extends Q>(
  questions: readonly T[] = [],
): { context: string; items: T[] }[] {
  const blocks: { context: string; items: T[] }[] = [];
  let current: { context: string; items: T[] } | null = null;
  for (const q of questions) {
    const ctx = (q.context ?? '').trim();
    if (!current) {
      current = { context: ctx, items: [q] };
      blocks.push(current);
    } else if (ctx && ctx === current.context) current.items.push(q);
    else if (!ctx && !current.context) current.items.push(q);
    else {
      current = { context: ctx, items: [q] };
      blocks.push(current);
    }
  }
  return blocks;
}

/** Shuffles inside each block, then the blocks: a passage's questions stay together and parts do not mix. Returns question ids. */
export function generateShuffledQuestionOrder(questions: readonly Q[] = []): number[] {
  if (!Array.isArray(questions) || questions.length <= 1) return (questions ?? []).map((q) => q.id);
  const blocks = partitionIntoBlocks(questions).map((b) => ({
    ...b,
    items: shuffleArray(b.items),
  }));
  return shuffleArray(blocks)
    .flatMap((b) => b.items)
    .map((q) => q.id);
}

const UNSAFE = [
  /\b[A-D]\s*(&|\+|và|and|,)\s*[A-D]\b/i,
  /\b(both|either|neither)\s+[A-D]\b/i,
  /\b(phương án|đáp án|lựa chọn|option)\s+[A-D]\b/i,
  /\b(all|none)\s+of\s+the\s+above\b/i,
  /\ball\s+(are\s+)?correct\b/i,
  /tất cả (các )?(đáp án|phương án|lựa chọn|câu trên)/i,
  /cả [A-D] (và|với) [A-D]/i,
  /không có (đáp án|phương án nào)/i,
];

/** An option that refers to others ("A and B", "all of the above") must keep its place or its meaning breaks. */
export function canShuffleOptions(question: Q | null | undefined): boolean {
  if (isEssayQuestion(question)) return false;
  if (!question?.options) return true;
  const texts = ['A', 'B', 'C', 'D']
    .map((k) => String(question.options?.[k] ?? '').trim())
    .filter(Boolean);
  return !texts.some((t) => UNSAFE.some((p) => p.test(t)));
}

/** { [questionId]: ['B','D','A','C'] }: display position i shows the original option order[i]. */
export function generateShuffledOptionsOrder(
  questions: readonly Q[] = [],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const q of questions ?? []) {
    const qid = String(q.id);
    if (isEssayQuestion(q)) continue;
    if (!canShuffleOptions(q)) {
      out[qid] = ['A', 'B', 'C', 'D'];
      continue;
    }
    const available = ['A', 'B', 'C', 'D'].filter((k) =>
      Boolean(q.options?.[k] && String(q.options[k]).trim()),
    );
    if (available.length <= 1) {
      out[qid] = ['A', 'B', 'C', 'D'];
      continue;
    }
    const shuffled = shuffleArray(available);
    out[qid] = ['A', 'B', 'C', 'D'].map((k, i) => shuffled[i] ?? k);
  }
  return out;
}
