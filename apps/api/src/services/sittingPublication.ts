// Created by Haihs on 12/11/2026
// Publication figures for the teacher (ready/ungraded/stale counts, answer-leak warning) and the atomic publish. Port of server/services/sittingPublication.js.
import type { Types } from 'mongoose';
import { ExamSittingModel, type IExamSitting } from '../models/ExamSitting';
import { SittingGrantModel } from '../models/SittingGrant';
import { SittingSubmissionModel } from '../models/SittingSubmission';
import { classifySubmission, getGateAt, isPastGate, SUBMIT_GRACE_MS } from './resultPublication';
import { getSittingAvailability } from './sittingLookup';

const MAX_LEAK_ITEMS = 5;
type SittingDoc = Pick<
  IExamSitting,
  'questions' | 'closeAt' | 'createdBy' | 'templateId' | 'resultsPublishedAt'
> & { _id: Types.ObjectId };

/** Counts submissions: ungraded blocks publishing, stale (among non-ungraded) only warns. The owner's trial submissions do not count. */
export async function countSubmissions(sitting: SittingDoc) {
  const subs = await SittingSubmissionModel.find({
    sittingId: sitting._id,
    byTeacher: { $ne: true },
  })
    .select('essayResults.questionId essayResults.criteria.key essayResults.total essayStale')
    .lean();
  const counts = { submittedCount: subs.length, readyCount: 0, ungradedCount: 0, staleCount: 0 };
  for (const sub of subs) {
    const { status, stale } = classifySubmission(sitting.questions, sub);
    if (status === 'ready') {
      counts.readyCount += 1;
      if (stale) counts.staleCount += 1;
    } else counts.ungradedCount += 1;
  }
  return counts;
}

/** OTHER sittings not yet closed (closeAt + 120s > now) of the same template and the SAME owner; never reads another teacher's data. */
async function findLeak(sitting: SittingDoc, now: Date) {
  if (!sitting.templateId) return { otherOpenSittings: 0, items: [] };
  const filter = {
    createdBy: sitting.createdBy,
    templateId: sitting.templateId,
    _id: { $ne: sitting._id },
    closeAt: { $gt: new Date(now.getTime() - SUBMIT_GRACE_MS) },
  };
  const [otherOpenSittings, rows] = await Promise.all([
    ExamSittingModel.countDocuments(filter),
    ExamSittingModel.find(filter)
      .select('title openAt closeAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_LEAK_ITEMS)
      .lean(),
  ]);
  return {
    otherOpenSittings,
    items: rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      status: getSittingAvailability(r, now).status,
    })),
  };
}

export async function getPublicationInfo(sitting: SittingDoc, now = new Date()) {
  const [counts, leak, grantCount] = await Promise.all([
    countSubmissions(sitting),
    findLeak(sitting, now),
    SittingGrantModel.countDocuments({ sittingId: sitting._id }),
  ]);
  const reasons: string[] = [];
  if (counts.ungradedCount > 0) reasons.push('UNGRADED');
  const publishedAt = sitting.resultsPublishedAt ?? null;
  return {
    publishedAt,
    gateAt: getGateAt(sitting),
    ended: isPastGate(sitting, now),
    ...counts,
    notSubmittedCount: Math.max(0, grantCount - counts.submittedCount),
    hiddenCount: publishedAt ? counts.ungradedCount : 0,
    canPublish: reasons.length === 0,
    reasons,
    leak,
  };
}

/**
 * Atomic publish: "not yet published" is in the write's filter. A race with manual grading / editing AFTER the ungraded check is accepted:
 * isResultVisible checks ready on every student read. true when this call was the writer.
 */
export async function publishAtomic(
  sitting: { _id: Types.ObjectId; createdBy: Types.ObjectId },
  now: Date,
): Promise<boolean> {
  const res = await ExamSittingModel.updateOne(
    { _id: sitting._id, createdBy: sitting.createdBy, resultsPublishedAt: null },
    { $set: { resultsPublishedAt: now } },
  );
  return res.matchedCount > 0;
}
