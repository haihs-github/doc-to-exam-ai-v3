// Created by Haihs on 12/11/2026
// Regrade every submission of a sitting after its questions changed: redo mcq, keep essay scores (clamped by the new maxScore), mark essayStale. Port of server/services/regrade.js.
import type { Types } from 'mongoose';
import {
  computeScoring,
  gradeSubmission,
  isEssayQuestion,
  type Question,
} from '../lib/examValidation';
import { SittingSubmissionModel } from '../models/SittingSubmission';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Signature of the essay content/rubric: a change means graded essays must be re-graded on purpose (essayStale). */
export const essaySignature = (questions: unknown[] | undefined): string =>
  JSON.stringify(
    ((questions ?? []) as Question[]).filter(isEssayQuestion).map((q) => ({
      id: q.id,
      questionText: q.questionText,
      requirements: q.requirements ?? '',
      maxScore: q.maxScore,
      rubric: (q.rubric ?? []).map((r) => ({ key: r.key, label: r.label, max: r.max })),
    })),
  );

/** Called AFTER the new questions are written, so submissions that slipped in meanwhile are covered too. */
export async function regradeSittingSubmissions(
  sitting: { _id: Types.ObjectId; questions: unknown[] },
  previousSignature: string,
): Promise<number> {
  const questions = sitting.questions as Question[];
  const essayChanged = essaySignature(questions) !== previousSignature;
  const { total: totalScore, essayMax } = computeScoring(questions);
  const essayMaxById = new Map(
    questions.filter(isEssayQuestion).map((q) => [q.id, q.maxScore ?? 0]),
  );
  let count = 0;
  for await (const submission of SittingSubmissionModel.find({ sittingId: sitting._id }).cursor()) {
    const { correctCount, totalQuestions, score } = gradeSubmission(
      questions,
      submission.answers,
      submission.optionsOrder,
    );
    submission.correctCount = correctCount;
    submission.totalQuestions = totalQuestions;
    submission.mcqScore = score;
    let essayScore: number;
    if (essayMaxById.size === 0) essayScore = 0;
    else if (Array.isArray(submission.essayResults) && submission.essayResults.length > 0)
      essayScore = submission.essayResults.reduce(
        (sum, r) =>
          essayMaxById.has(r.questionId)
            ? sum + Math.min(r.total || 0, essayMaxById.get(r.questionId) as number)
            : sum,
        0,
      );
    else essayScore = Math.min(submission.essayScore || 0, essayMax);
    submission.essayScore = round2(essayScore);
    submission.score = Math.min(round2(score + submission.essayScore), totalScore);
    submission.maxScore = totalScore;
    if (essayChanged && submission.essayAnswers.length > 0) {
      submission.essayStale = true;
      submission.essayStaleAt = new Date();
    }
    await submission.save();
    count += 1;
  }
  return count;
}

/**
 * After a manual grade is saved: a stale submission whose every current essay has gradedAt >= essayStaleAt loses the flag.
 * The write is conditional on the essayStaleAt that was read, so a regrade stamping a newer mark meanwhile is not cleared by mistake.
 */
export async function clearEssayStaleIfRegraded(
  submissionId: Types.ObjectId,
  questions: unknown[],
): Promise<boolean> {
  const sub = await SittingSubmissionModel.findById(submissionId)
    .select('essayStale essayStaleAt essayResults.questionId essayResults.gradedAt')
    .lean();
  if (!sub || sub.essayStale !== true) return false;
  const since = sub.essayStaleAt ? sub.essayStaleAt.getTime() : 0; // null (stale from before) = mark 0
  const gradedAt = new Map(
    (sub.essayResults ?? []).map((r) => [
      r.questionId,
      r.gradedAt ? new Date(r.gradedAt).getTime() : -1,
    ]),
  );
  const essays = (questions as Question[]).filter(isEssayQuestion);
  if (!essays.every((q) => gradedAt.has(q.id) && (gradedAt.get(q.id) as number) >= since))
    return false;
  const res = await SittingSubmissionModel.updateOne(
    { _id: submissionId, essayStale: true, essayStaleAt: sub.essayStaleAt ?? null },
    { $set: { essayStale: false, essayStaleAt: null } },
  );
  return res.matchedCount > 0;
}
