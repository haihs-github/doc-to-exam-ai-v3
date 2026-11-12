// Created by Haihs on 12/11/2026
// Result payload for the student (explicit whitelist, never a spread document); scores recomputed at read time. The student sees SCORES only: no answers, explanations or per-question detail. Port of server/services/studentResult.js.
import { computeResultScores } from './resultPublication';

type SittingLike = {
  _id: unknown;
  title: string;
  openAt: Date;
  closeAt: Date;
  resultsPublishedAt?: Date | null;
  questions: unknown[];
};
type SubLike = Parameters<typeof computeResultScores>[1] & { submittedAt: Date };

/** GET /api/me/sittings/:id/result: `reviewing` stands for essayStale. */
export function buildResultPayload(sitting: SittingLike, submission: SubLike) {
  const s = computeResultScores(sitting.questions, submission);
  return {
    sitting: {
      id: String(sitting._id),
      title: sitting.title,
      openAt: sitting.openAt.toISOString(),
      closeAt: sitting.closeAt.toISOString(),
      resultsPublishedAt: sitting.resultsPublishedAt
        ? sitting.resultsPublishedAt.toISOString()
        : null,
    },
    submission: {
      submittedAt: submission.submittedAt.toISOString(),
      reviewing: submission.essayStale === true,
    },
    summary: {
      score: s.score,
      maxScore: s.maxScore,
      mcqScore: s.mcqScore,
      mcqMax: s.mcqMax,
      essayScore: s.essayScore,
      essayMax: s.essayMax,
    },
  };
}

/** The `result` badge of list/resolve/getOne: total score only, and only when called after isResultVisible. */
export function toResultBadge(
  questions: unknown[],
  submission: SubLike,
): { score: number; maxScore: number } {
  const { score, maxScore } = computeResultScores(questions, submission);
  return { score, maxScore };
}
