// Created by Haihs on 12/11/2026
// Writes manual essay grades into a submission (atomic, optimistic lock by gradedAt), recomputes scores and gradingStatus. Port of server/services/manualGradingStore.js.
import type { Types } from 'mongoose';
import { isEssayQuestion, type Question } from '../lib/examValidation';
import { ExamSittingModel } from '../models/ExamSitting';
import { SittingSubmissionModel, type IEssayResult } from '../models/SittingSubmission';

/** essayScore and score = mcqScore + essayScore computed IN the DB (atomic, clamped by the submission's maxScore). */
export const recomputeScores = (submissionId: Types.ObjectId) =>
  SittingSubmissionModel.updateOne(
    { _id: submissionId },
    [
      {
        $set: {
          essayScore: { $round: [{ $sum: '$essayResults.total' }, 2] },
          score: {
            $let: {
              vars: {
                raw: {
                  $round: [
                    { $add: [{ $ifNull: ['$mcqScore', 0] }, { $sum: '$essayResults.total' }] },
                    2,
                  ],
                },
              },
              in: { $cond: [{ $gt: ['$maxScore', 0] }, { $min: ['$$raw', '$maxScore'] }, '$$raw'] },
            },
          },
        },
      },
    ],
    { updatePipeline: true },
  );

/**
 * Replace (or add) one question's result with an atomic write.
 * expectedGradedAt: undefined = no lock; null = only if NOT graded yet; Date = only if the current gradedAt equals it.
 */
async function upsertOnce(
  submissionId: Types.ObjectId,
  entry: IEssayResult,
  expected: Date | null | undefined,
): Promise<boolean> {
  const elemFilter: Record<string, unknown> = { questionId: entry.questionId };
  if (expected instanceof Date) elemFilter.gradedAt = expected;
  if (expected === null) elemFilter.gradedAt = null;
  const replaced = await SittingSubmissionModel.updateOne(
    { _id: submissionId, essayResults: { $elemMatch: elemFilter } },
    { $set: { 'essayResults.$': entry } },
  );
  if (replaced.matchedCount > 0) return true;
  if (expected instanceof Date) return false; // a specific mark that does not match = edited elsewhere
  const pushed = await SittingSubmissionModel.updateOne(
    { _id: submissionId, 'essayResults.questionId': { $ne: entry.questionId } },
    { $push: { essayResults: entry } },
  );
  return pushed.matchedCount > 0;
}
export async function upsertEssayResult(
  submissionId: Types.ObjectId,
  entry: IEssayResult,
  opts: { expectedGradedAt?: Date | null } = {},
): Promise<boolean> {
  if (await upsertOnce(submissionId, entry, opts.expectedGradedAt)) return true;
  return opts.expectedGradedAt === undefined ? upsertOnce(submissionId, entry, undefined) : false; // retry once when there is no lock
}

/** gradingStatus: 'done' when every essay of the sitting has a teacher result, else 'pending'. 'none' stays. */
export async function refreshSubmissionStatus(
  submissionId: Types.ObjectId,
): Promise<'done' | 'pending' | null> {
  const sub = await SittingSubmissionModel.findById(submissionId)
    .select('essayResults gradingStatus sittingId')
    .lean();
  if (!sub || sub.gradingStatus === 'none') return null;
  const sitting = await ExamSittingModel.findById(sub.sittingId).select('questions').lean();
  if (!sitting) return null;
  const essayIds = (sitting.questions as unknown as Question[])
    .filter(isEssayQuestion)
    .map((q) => q.id);
  if (essayIds.length === 0) return null;
  const graded = new Set((sub.essayResults ?? []).map((r) => r.questionId));
  const status = essayIds.every((id) => graded.has(id)) ? 'done' : 'pending';
  await SittingSubmissionModel.updateOne(
    { _id: submissionId },
    { $set: { gradingStatus: status } },
  );
  return status;
}
