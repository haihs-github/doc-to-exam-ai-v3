// Created by Haihs on 12/11/2026
// Pure helpers of result publication: the closing gate, ready/ungraded classification + stale flag, scores recomputed at read time, isResultVisible. Port of server/services/resultPublication.js.
import {
  computeScoring,
  gradeSubmission,
  isEssayQuestion,
  type Question,
} from '../lib/examValidation';

export const SUBMIT_GRACE_MS = 120 * 1000;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Earliest moment results may be published/shown: closeAt + 120 seconds. */
export const getGateAt = (s: { closeAt: Date | string }): Date =>
  new Date(new Date(s.closeAt).getTime() + SUBMIT_GRACE_MS);
export const isPastGate = (s: { closeAt: Date | string }, now = new Date()): boolean =>
  now.getTime() >= getGateAt(s).getTime();

const sameKeys = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  b.every((k) => a.includes(k));

type SubLike = {
  essayResults?: { questionId: number; criteria?: { key: string }[]; total?: number }[];
  essayStale?: boolean;
  answers?: unknown;
  optionsOrder?: unknown;
};

/**
 * Classified against the CURRENT questions (not gradingStatus): ready = every essay has a result whose criterion keys match the current rubric
 * and total <= maxScore; otherwise ungraded. stale is a separate warning flag (essayStale), it does not change the status.
 */
export function classifySubmission(
  questions: unknown[],
  submission: SubLike,
): { status: 'ready' | 'ungraded'; stale: boolean } {
  const results = new Map((submission.essayResults ?? []).map((r) => [r.questionId, r]));
  const ready = ((questions ?? []) as Question[]).filter(isEssayQuestion).every((q) => {
    const r = results.get(q.id);
    if (!r) return false;
    return (
      sameKeys(
        (q.rubric ?? []).map((c) => c.key),
        (r.criteria ?? []).map((c) => c.key),
      ) && (r.total ?? 0) <= (q.maxScore ?? 0) + 1e-9
    ); // float tolerance
  });
  return { status: ready ? 'ready' : 'ungraded', stale: submission.essayStale === true };
}

/** Scores recomputed from the raw data (mcq answers + essayResults) against the CURRENT questions; the stored score is not read. */
export function computeResultScores(questions: unknown[], submission: SubLike) {
  const qs = (questions ?? []) as Question[];
  const {
    correctCount,
    totalQuestions,
    score: mcqScore,
  } = gradeSubmission(qs, submission.answers, submission.optionsOrder);
  const { mcqMax, essayMax, total } = computeScoring(qs);
  const essayMaxById = new Map(qs.filter(isEssayQuestion).map((q) => [q.id, q.maxScore ?? 0]));
  const essayScore = round2(
    (submission.essayResults ?? []).reduce(
      (sum, r) =>
        essayMaxById.has(r.questionId)
          ? sum + Math.min(r.total ?? 0, essayMaxById.get(r.questionId) as number)
          : sum,
      0,
    ),
  );
  return {
    score: Math.min(round2(mcqScore + essayScore), total),
    maxScore: total,
    mcqScore,
    mcqMax,
    essayScore,
    essayMax,
    correctCount,
    mcqTotal: totalQuestions,
  };
}

/** May the student see this result: the sitting is published AND the submission is ready. */
export const isResultVisible = (
  sitting: { resultsPublishedAt?: Date | null; questions: unknown[] },
  submission: SubLike,
): boolean =>
  sitting.resultsPublishedAt != null &&
  classifySubmission(sitting.questions, submission).status === 'ready';
