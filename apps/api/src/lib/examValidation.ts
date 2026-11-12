// Created by Haihs on 12/11/2026
// Question validation, essay rubric, scoring scale and MCQ grading. Port of server/utils/examValidation.js (all messages kept).
import { isQuarterStep, SCORE_STEP } from './essayScore';

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];
export const MAX_DURATION_MINUTES = 600;
export const QUESTION_TYPE_MCQ = 'mcq';
export const QUESTION_TYPE_ESSAY = 'essay';
export const TOTAL_SCORE = 10; // exam total: mcqMax + essayMax
export const MAX_ESSAY_CHARS = 15000;
const MAX_RUBRIC_CRITERIA = 20;

export interface RubricCriterion {
  key: string;
  label: string;
  max: number;
}
export interface Question {
  id: number;
  type?: 'mcq' | 'essay';
  context: string;
  questionText: string;
  options?: Record<OptionKey, string>;
  correctAnswer?: OptionKey;
  explanation: string;
  requirements?: string;
  rubric?: RubricCriterion[];
  maxScore?: number;
}
type Raw = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const roundScore = (v: number): number => Math.round(v * 100) / 100;

// Default rubric when the document has none: 5 criteria x 0.5 = 2.5 points; the teacher confirms or edits it.
export const DEFAULT_ESSAY_RUBRIC: readonly Readonly<RubricCriterion>[] = Object.freeze([
  Object.freeze({ key: 'layout', label: 'Bố cục rõ ràng', max: 0.5 }),
  Object.freeze({ key: 'ideas', label: 'Ý rõ, đủ luận điểm', max: 0.5 }),
  Object.freeze({ key: 'vocabulary', label: 'Từ vựng và cấu trúc phù hợp', max: 0.5 }),
  Object.freeze({ key: 'linking', label: 'Sử dụng liên từ hợp lý', max: 0.5 }),
  Object.freeze({ key: 'mechanics', label: 'Ít lỗi chính tả/ngữ pháp', max: 0.5 }),
]);

/** Essay only when type === 'essay'; anything else is mcq (old data has no type). */
export const isEssayQuestion = (q: unknown): boolean =>
  Boolean(q) && (q as Raw).type === QUESTION_TYPE_ESSAY;
export const hasEssayQuestions = (qs: unknown[] = []): boolean => (qs ?? []).some(isEssayQuestion);

/** Normalises one essay rubric: empty -> default; each max > 0 and a multiple of 0.25; keys unique; maxScore = sum. */
export function buildEssayRubric(
  rawRubric: unknown,
  rawMaxScore: unknown,
): { rubric: RubricCriterion[]; maxScore: number; errors: string[] } {
  const errors: string[] = [];
  const hasMax = rawMaxScore !== undefined && rawMaxScore !== null && rawMaxScore !== '';
  const declared = hasMax ? Number(rawMaxScore) : null;
  if (hasMax && (!Number.isFinite(declared) || (declared as number) <= 0))
    errors.push('điểm tối đa (maxScore) phải là số lớn hơn 0');

  const items = Array.isArray(rawRubric) ? rawRubric.slice(0, MAX_RUBRIC_CRITERIA) : [];
  let rubric: RubricCriterion[] = [];
  let defaulted = false;
  if (items.length === 0) {
    rubric = DEFAULT_ESSAY_RUBRIC.map((i) => ({ ...i }));
    defaulted = true;
  } else {
    const seen = new Set<string>();
    items.forEach((rawItem, idx) => {
      const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Raw;
      const key = str(item.key) || `c${idx + 1}`;
      const label = str(item.label);
      const max = Number(item.max);
      if (!label) errors.push(`tiêu chí ${idx + 1} thiếu tên`);
      if (!Number.isFinite(max) || max <= 0)
        errors.push(`tiêu chí ${idx + 1} phải có điểm tối đa lớn hơn 0`);
      if (Number.isFinite(max) && max > 0 && !isQuarterStep(max))
        errors.push(`tiêu chí ${idx + 1} phải có điểm tối đa là bội số của ${SCORE_STEP}`);
      if (seen.has(key)) errors.push(`tiêu chí ${idx + 1} bị trùng mã "${key}"`);
      seen.add(key);
      rubric.push({ key, label, max: Number.isFinite(max) ? max : 0 });
    });
  }
  const maxScore = roundScore(rubric.reduce((sum, i) => sum + i.max, 0));
  if (hasMax && Number.isFinite(declared) && (declared as number) > 0) {
    if (defaulted && roundScore(declared as number) !== maxScore)
      errors.push(
        `thiếu tiêu chí chấm nhưng điểm tối đa là ${declared} (tiêu chí mặc định là ${maxScore} điểm)`,
      );
    else if (!defaulted && roundScore(declared as number) !== maxScore)
      errors.push(`tổng điểm tiêu chí (${maxScore}) phải bằng điểm tối đa của câu (${declared})`);
  }
  return { rubric, maxScore, errors };
}

/** No essay: mcqMax = 10; with essay: mcqMax = 10 - essayMax; all essay: mcqMax = 0. */
export function computeScoring(questions: unknown[] = []): {
  mcqMax: number;
  essayMax: number;
  total: number;
} {
  const list = (questions ?? []) as Raw[];
  const essays = list.filter(isEssayQuestion);
  if (essays.length === 0) return { mcqMax: TOTAL_SCORE, essayMax: 0, total: TOTAL_SCORE };
  const essayMax = roundScore(essays.reduce((sum, q) => sum + (Number(q.maxScore) || 0), 0));
  const hasMcq = list.some((q) => !isEssayQuestion(q));
  const mcqMax = hasMcq ? roundScore(Math.max(0, TOTAL_SCORE - essayMax)) : 0;
  return { mcqMax, essayMax, total: roundScore(mcqMax + essayMax) };
}

/**
 * Validates and normalises the questions sent by the client. Ids are the link to submitted answers: positive,
 * unique, never renumbered by the server.
 */
export function sanitizeQuestions(rawQuestions: unknown): {
  questions: Question[];
  errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0)
    return { questions: [], errors: ['Đề thi phải có ít nhất 1 câu hỏi.'] };

  const seenIds = new Set<number>();
  const questions: Question[] = [];
  rawQuestions.forEach((raw, index) => {
    const position = index + 1;
    const q = (raw && typeof raw === 'object' ? raw : {}) as Raw;
    const parsedId = Number(q.id);
    let id: number | null = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    if (id === null) {
      errors.push(`Câu ${position}: thiếu mã câu hỏi hợp lệ.`);
      id = position;
    }
    if (seenIds.has(id))
      errors.push(
        `Câu ${position}: mã câu hỏi #${id} bị trùng với câu khác. Mỗi câu hỏi phải có mã riêng để không làm sai điểm các bài đã nộp.`,
      );
    seenIds.add(id);

    // needsReview only blocks while the data is still incomplete; complete data counts as confirmed.
    const needsReviewMessage = `Câu ${position}: chưa được xác nhận loại câu hỏi (trắc nghiệm hay tự luận), vui lòng kiểm tra lại.`;

    if (q.type === QUESTION_TYPE_ESSAY) {
      const questionText = str(q.questionText);
      const requirements = str(q.requirements);
      if (!questionText && !requirements)
        errors.push(`Câu ${position}: câu tự luận phải có đề bài hoặc yêu cầu.`);
      const built = buildEssayRubric(q.rubric, q.maxScore);
      built.errors.forEach((m) => errors.push(`Câu ${position}: ${m}.`));
      if (q.needsReview === true && built.errors.length > 0) errors.push(needsReviewMessage);
      questions.push({
        id,
        type: QUESTION_TYPE_ESSAY,
        context: str(q.context),
        questionText,
        requirements,
        rubric: built.rubric,
        maxScore: built.maxScore,
        explanation: str(q.explanation),
      });
      return;
    }

    const errorsBefore = errors.length;
    const rawOptions = (q.options && typeof q.options === 'object' ? q.options : {}) as Raw;
    const options = {} as Record<OptionKey, string>;
    OPTION_KEYS.forEach((k) => {
      options[k] = str(rawOptions[k]);
    });
    if (!options.A || !options.B)
      errors.push(`Câu ${position}: phải nhập ít nhất phương án A và B.`);
    const correct = str(q.correctAnswer).toUpperCase();
    if (!(OPTION_KEYS as readonly string[]).includes(correct))
      errors.push(
        `Câu ${position}: đáp án đúng phải là A, B, C hoặc D${correct ? ` (đang là "${correct}")` : ''}.`,
      );
    else if (!options[correct as OptionKey])
      errors.push(
        `Câu ${position}: đáp án đúng là ${correct} nhưng phương án ${correct} đang để trống.`,
      );
    if (q.needsReview === true && errors.length > errorsBefore) errors.push(needsReviewMessage);
    questions.push({
      id,
      context: str(q.context),
      questionText: str(q.questionText),
      options,
      correctAnswer: (OPTION_KEYS as readonly string[]).includes(correct)
        ? (correct as OptionKey)
        : 'A',
      explanation: str(q.explanation),
    });
  });

  const essays = questions.filter(isEssayQuestion);
  if (essays.length > 0) {
    const { essayMax } = computeScoring(questions);
    const hasMcq = questions.some((q) => !isEssayQuestion(q));
    if (hasMcq ? essayMax >= TOTAL_SCORE : essayMax > TOTAL_SCORE)
      errors.push(
        hasMcq
          ? `Đề có cả trắc nghiệm: tổng điểm tự luận phải nhỏ hơn ${TOTAL_SCORE} để còn điểm cho trắc nghiệm (hiện là ${essayMax}).`
          : `Đề toàn tự luận: tổng điểm tự luận không được vượt quá ${TOTAL_SCORE} (hiện là ${essayMax}).`,
      );
  }
  return { questions, errors };
}

/** Sitting schedule: duration 1..600 minutes, valid dates, open before close. */
export function validateExamSchedule(c: {
  durationMinutes: unknown;
  startTime: unknown;
  endTime: unknown;
}): { errors: string[]; durationMinutes: number; startDate: Date; endDate: Date } {
  const errors: string[] = [];
  const duration = Number(c.durationMinutes);
  if (!Number.isFinite(duration) || duration < 1)
    errors.push('Thời gian làm bài phải lớn hơn 0 phút.');
  else if (duration > MAX_DURATION_MINUTES)
    errors.push(`Thời gian làm bài tối đa là ${MAX_DURATION_MINUTES} phút.`);
  const startDate = new Date(c.startTime as string);
  const endDate = new Date(c.endTime as string);
  if (!c.startTime || Number.isNaN(startDate.getTime()))
    errors.push('Thời gian mở đề không hợp lệ.');
  if (!c.endTime || Number.isNaN(endDate.getTime())) errors.push('Thời gian đóng đề không hợp lệ.');
  if (
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime()) &&
    startDate >= endDate
  )
    errors.push('Thời gian mở đề phải diễn ra trước thời gian đóng đề.');
  return { errors, durationMinutes: duration, startDate, endDate };
}

/** ONE mapping of options by `optionsOrder`, shared by grading and the result page so isCorrect always matches correctCount. */
export function mapByOptionsOrder(
  question: { options?: Record<string, string>; correctAnswer?: string },
  order: unknown,
  rawAnswer?: unknown,
): {
  displayOptions: Record<OptionKey, string>;
  correctDisplayKey: string;
  yourDisplayKey: string | null;
  isCorrect: boolean;
} {
  const arr = Array.isArray(order) && order.length > 0 ? (order as string[]) : null;
  const original = str(question.correctAnswer).toUpperCase();
  const idx = arr ? arr.indexOf(original) : -1;
  const correctDisplayKey = idx !== -1 && OPTION_KEYS[idx] ? OPTION_KEYS[idx] : original;
  const given = str(rawAnswer).toUpperCase();
  return {
    // own keys only, so an order containing 'constructor' / '__proto__' cannot return a function or prototype
    displayOptions: Object.fromEntries(
      OPTION_KEYS.map((k, i) => {
        const key = arr?.[i] ?? k;
        return [
          k,
          (question.options && Object.hasOwn(question.options, key)
            ? question.options[key]
            : undefined) ?? '',
        ];
      }),
    ) as Record<OptionKey, string>,
    correctDisplayKey,
    yourDisplayKey: (OPTION_KEYS as readonly string[]).includes(given) ? given : null,
    isCorrect: given !== '' && given === correctDisplayKey,
  };
}

const toRecord = (v: unknown): Raw =>
  v instanceof Map ? Object.fromEntries(v) : ((v && typeof v === 'object' ? v : {}) as Raw);

/** MCQ score = correct / mcq total * mcqMax; essays are not counted here. */
export function gradeSubmission(
  questions: Question[] = [],
  rawAnswers: unknown = {},
  rawOptionsOrder: unknown = {},
): { correctCount: number; totalQuestions: number; score: number } {
  const answers = toRecord(rawAnswers);
  const optionsOrder = toRecord(rawOptionsOrder);
  const mcq = questions.filter((q) => !isEssayQuestion(q));
  const { mcqMax } = computeScoring(questions);
  let correctCount = 0;
  for (const q of mcq) {
    const qid = String(q.id);
    if (mapByOptionsOrder(q, optionsOrder[qid], answers[qid]).isCorrect) correctCount += 1;
  }
  const raw = mcq.length > 0 ? (correctCount / mcq.length) * mcqMax : 0;
  return { correctCount, totalQuestions: mcq.length, score: Math.round(raw * 100) / 100 };
}

/** Keeps only A/B/C/D answers of real MCQ questions. */
export function sanitizeAnswers(
  rawAnswers: unknown,
  questions: Question[] = [],
): Record<string, string> {
  const valid = new Set(questions.filter((q) => !isEssayQuestion(q)).map((q) => String(q.id)));
  const source = toRecord(rawAnswers);
  const out: Record<string, string> = {};
  for (const key of Object.keys(source)) {
    if (!valid.has(String(key))) continue;
    const v = str(source[key]).toUpperCase();
    if ((OPTION_KEYS as readonly string[]).includes(v)) out[String(key)] = v;
  }
  return out;
}

/** Text essay answers: only real essay questions, cut at MAX_ESSAY_CHARS. */
export function sanitizeEssayAnswers(
  rawEssayAnswers: unknown,
  questions: Question[] = [],
): { questionId: number; text: string; source: 'text'; extractedChars: number }[] {
  const ids = new Set((questions ?? []).filter(isEssayQuestion).map((q) => String(q.id)));
  const source = toRecord(rawEssayAnswers);
  const out: { questionId: number; text: string; source: 'text'; extractedChars: number }[] = [];
  for (const key of Object.keys(source)) {
    if (!ids.has(String(key))) continue;
    const v = source[key];
    if (typeof v !== 'string') continue;
    const text = v.trim().slice(0, MAX_ESSAY_CHARS);
    out.push({ questionId: Number(key), text, source: 'text', extractedChars: text.length });
  }
  return out;
}
