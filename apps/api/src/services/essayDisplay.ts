// Created by Haihs on 12/11/2026
// How a submission with essay questions is shown to the teacher: graded or not, label, total only when fully graded. Port of server/utils/essayDisplay.js.
import { isEssayQuestion, type Question } from '../lib/examValidation';

const roundScore = (v: number): number => Math.round(v * 100) / 100;
export const ESSAY_GRADING_LABELS = {
  none: '',
  ungraded: 'Chưa chấm',
  partial: 'Chấm một phần',
  teacher: 'Giáo viên chấm',
} as const;
type Code = keyof typeof ESSAY_GRADING_LABELS;

export interface EssayDisplay {
  hasEssay: boolean;
  essayQuestionCount: number;
  essayGradedCount: number;
  essayGraded: boolean;
  totalScore: number | null;
  gradingLabelCode: Code;
  gradingLabel: string;
}

/**
 * No essay (mcq exam / old 'none' submission): essayGraded true, totalScore = score, empty label.
 * With essay: totalScore is a number ONLY when every essay question has a result; otherwise null.
 */
export function computeEssayDisplay(
  submission: { gradingStatus?: string; essayResults?: { questionId: number }[]; score?: number },
  questions: unknown[],
): EssayDisplay {
  const essayIds = new Set(
    ((questions ?? []) as Question[]).filter(isEssayQuestion).map((q) => q.id),
  );
  if (essayIds.size === 0 || (submission.gradingStatus ?? 'none') === 'none')
    return {
      hasEssay: false,
      essayQuestionCount: essayIds.size,
      essayGradedCount: 0,
      essayGraded: true,
      totalScore: submission.score ?? 0,
      gradingLabelCode: 'none',
      gradingLabel: '',
    };
  const results = new Set(
    (submission.essayResults ?? [])
      .filter((r) => essayIds.has(r.questionId))
      .map((r) => r.questionId),
  );
  const essayGradedCount = results.size;
  const essayGraded = essayGradedCount === essayIds.size;
  const code: Code = essayGraded ? 'teacher' : essayGradedCount > 0 ? 'partial' : 'ungraded';
  return {
    hasEssay: true,
    essayQuestionCount: essayIds.size,
    essayGradedCount,
    essayGraded,
    totalScore: essayGraded ? roundScore(submission.score ?? 0) : null,
    gradingLabelCode: code,
    gradingLabel: ESSAY_GRADING_LABELS[code],
  };
}

/** Score stats ONLY over submissions that have a total (an ungraded essay does not enter avg/max/min). */
export function summarizeStats(items: { totalScore: number | null }[]) {
  const scores = items.map((i) => i.totalScore).filter((v): v is number => typeof v === 'number');
  if (scores.length === 0) return { gradedSubmissions: 0, avgScore: 0, maxScore: 0, minScore: 0 };
  const sum = scores.reduce((a, v) => a + v, 0);
  return {
    gradedSubmissions: scores.length,
    avgScore: Math.round((sum / scores.length) * 100) / 100,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
  };
}
