// Created by Haihs on 12/11/2026
// Pure logic of the question editor: normalising, type switch, rubric, 10-point scale, payload. Port of client/src/utils/examQuestions.js.

export const TOTAL_EXAM_SCORE = 10; // matches the server TOTAL_SCORE
export const RUBRIC_STEP = 0.25;
const roundScore = (v: number): number => Math.round(v * 100) / 100;

export type OptionKey = 'A' | 'B' | 'C' | 'D';
export interface RubricItem {
  key: string;
  label: string;
  max: number | string;
}
/** Editor-side question: loose types (inputs hold strings while typing). */
export interface EditorQuestion {
  id: number;
  type?: 'mcq' | 'essay';
  context: string;
  questionText: string;
  explanation: string;
  options: Record<OptionKey, string>;
  correctAnswer: string;
  requirements?: string;
  rubric?: RubricItem[];
  maxScore?: number | string;
  needsReview?: boolean;
  reviewReason?: string;
}
/** Untyped question coming from the server / AI draft (explicit keys: the strict tsconfig forbids dotted access on index signatures). */
interface Raw {
  id?: unknown;
  type?: unknown;
  context?: unknown;
  questionText?: unknown;
  explanation?: unknown;
  needsReview?: unknown;
  reviewReason?: unknown;
  requirements?: unknown;
  rubric?: unknown;
  maxScore?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
}
interface RawRubricItem {
  key?: unknown;
  label?: unknown;
  max?: unknown;
}
interface RawOptions {
  A?: unknown;
  B?: unknown;
  C?: unknown;
  D?: unknown;
}

// Same as the server DEFAULT_ESSAY_RUBRIC: only a suggestion, the teacher confirms it.
export const DEFAULT_RUBRIC: RubricItem[] = [
  { key: 'layout', label: 'Bố cục rõ ràng', max: 0.5 },
  { key: 'ideas', label: 'Ý rõ, đủ luận điểm', max: 0.5 },
  { key: 'vocabulary', label: 'Từ vựng và cấu trúc phù hợp', max: 0.5 },
  { key: 'linking', label: 'Sử dụng liên từ hợp lý', max: 0.5 },
  { key: 'mechanics', label: 'Ít lỗi chính tả/ngữ pháp', max: 0.5 },
];

export const isEssay = (q: unknown): boolean => (q as Raw | null)?.type === 'essay';
export const cloneDefaultRubric = (): RubricItem[] => DEFAULT_RUBRIC.map((i) => ({ ...i }));
export const sumRubric = (rubric: RubricItem[] | undefined): number =>
  roundScore((rubric ?? []).reduce((s, i) => s + (Number(i.max) || 0), 0));

/** New criterion key that is not already used. */
export const nextRubricKey = (rubric: RubricItem[] | undefined): string => {
  const used = new Set((rubric ?? []).map((i) => i.key));
  let index = (rubric ?? []).length + 1;
  while (used.has(`c${index}`)) index += 1;
  return `c${index}`;
};

const EMPTY_OPTIONS = (): Record<OptionKey, string> => ({ A: '', B: '', C: '', D: '' });

/** Loads one question into the editor, keeping type/rubric/needsReview. A needsReview mcq keeps an empty answer to force a choice. */
export function normalizeEditorQuestion(q: Raw, id: number): EditorQuestion {
  const base = {
    id,
    context: String(q.context ?? ''),
    questionText: String(q.questionText ?? ''),
    explanation: String(q.explanation ?? ''),
  };
  const flags = q.needsReview
    ? { needsReview: true, reviewReason: String(q.reviewReason ?? '') }
    : {};
  if (isEssay(q)) {
    const raw = Array.isArray(q.rubric) ? (q.rubric as RawRubricItem[]) : [];
    const rubric: RubricItem[] =
      raw.length > 0
        ? raw.map((item, idx) => ({
            key: String(item.key || `c${idx + 1}`),
            label: String(item.label ?? ''),
            max: Number(item.max) || 0,
          }))
        : cloneDefaultRubric();
    return {
      ...base,
      type: 'essay',
      requirements: String(q.requirements ?? ''),
      rubric,
      maxScore: sumRubric(rubric),
      options: EMPTY_OPTIONS(),
      correctAnswer: '',
      ...flags,
    };
  }
  const o = (q.options ?? {}) as RawOptions;
  return {
    ...base,
    options: {
      A: String(o.A ?? ''),
      B: String(o.B ?? ''),
      C: String(o.C ?? ''),
      D: String(o.D ?? ''),
    },
    correctAnswer:
      q.needsReview && !q.correctAnswer ? '' : String(q.correctAnswer || 'A').toUpperCase(),
    ...flags,
  };
}

export const createEssayQuestion = (id: number, context = ''): EditorQuestion => ({
  id,
  type: 'essay',
  context,
  questionText: '',
  requirements: '',
  rubric: cloneDefaultRubric(),
  maxScore: sumRubric(DEFAULT_RUBRIC),
  explanation: '',
  options: EMPTY_OPTIONS(),
  correctAnswer: '',
});

export const createMcqQuestion = (id: number, context = ''): EditorQuestion => ({
  id,
  context,
  questionText: '',
  options: EMPTY_OPTIONS(),
  correctAnswer: 'A',
  explanation: '',
});

const omit = <T extends object>(o: T, keys: string[]): T =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k))) as T;

/** Switch type keeping the other type's data so switching back loses nothing; the teacher chose, so needsReview is cleared. */
export function convertQuestionType(q: EditorQuestion, next: 'mcq' | 'essay'): EditorQuestion {
  const rest = omit(q, ['needsReview', 'reviewReason']);
  if (next === 'essay') {
    const has = Array.isArray(rest.rubric) && rest.rubric.length > 0;
    const rubric = has ? (rest.rubric as RubricItem[]) : cloneDefaultRubric();
    return {
      ...rest,
      type: 'essay',
      requirements: rest.requirements ?? '',
      rubric,
      maxScore: sumRubric(rubric),
    };
  }
  return { ...omit(rest, ['type']), correctAnswer: rest.correctAnswer || '' };
}

export const isQuarterStep = (v: number): boolean =>
  Math.abs(v / RUBRIC_STEP - Math.round(v / RUBRIC_STEP)) < 1e-9;

/** Finite number > 0 and a multiple of 0.25 (empty string, text, negative and 0 are invalid). */
export function isValidScore(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && isQuarterStep(n);
}
/** Points of a question for totals: 0 until valid (a negative must not raise the remaining score). */
export const questionPoints = (q: { maxScore?: unknown } | undefined): number =>
  isValidScore(q?.maxScore) ? Number(q?.maxScore) : 0;
export const scoreFieldError = (value: unknown, subject = 'Điểm của câu'): string =>
  isValidScore(value) ? '' : `${subject} phải lớn hơn 0 và là bội số của 0,25`;

/** Re-splits criteria by their current ratio so the sum = newTotal, each a multiple of 0.25 and >= 0.25; the remainder goes to the last. */
export function redistributeCriteria(
  criteria: RubricItem[] | undefined,
  newTotal: unknown,
): { criteria: RubricItem[]; error: string } {
  const list = criteria ?? [];
  if (!isValidScore(newTotal)) return { criteria: list, error: scoreFieldError(newTotal) };
  const units = Math.round(Number(newTotal) / RUBRIC_STEP);
  if (list.length === 0) return { criteria: list, error: '' };
  if (units < list.length)
    return {
      criteria: list,
      error: `Điểm của câu (${newTotal}) quá nhỏ: cần ít nhất ${list.length * RUBRIC_STEP} điểm cho ${list.length} tiêu chí (mỗi tiêu chí tối thiểu ${RUBRIC_STEP})`,
    };
  const weights = list.map((i) => Math.max(0, Number(i.max) || 0));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let remaining = units;
  const next = list.map((item, i) => {
    const left = list.length - 1 - i;
    let u = remaining;
    if (left > 0) {
      const share = weightSum > 0 ? (units * weights[i]) / weightSum : units / list.length;
      u = Math.min(Math.max(1, Math.round(share)), remaining - left);
    }
    remaining -= u;
    return { ...item, max: u * RUBRIC_STEP };
  });
  return { criteria: next, error: '' };
}

/** Preview of the scale, same as the server computeScoring. */
export function computeScoringPreview(questions: EditorQuestion[] | undefined) {
  const list = questions ?? [];
  const essays = list.filter(isEssay);
  if (essays.length === 0)
    return { mcqMax: TOTAL_EXAM_SCORE, essayMax: 0, total: TOTAL_EXAM_SCORE };
  const essayMax = roundScore(essays.reduce((s, q) => s + questionPoints(q), 0));
  const hasMcq = list.some((q) => !isEssay(q));
  const mcqMax = hasMcq ? roundScore(Math.max(0, TOTAL_EXAM_SCORE - essayMax)) : 0;
  return { mcqMax, essayMax, total: roundScore(mcqMax + essayMax) };
}

/** Mixed exam: essay total strictly < 10; all-essay: <= 10. '' when valid. */
export function describeEssayTotalError({
  essayMax,
  hasMcq,
}: {
  essayMax: number;
  hasMcq: boolean;
}): string {
  if (hasMcq ? essayMax >= TOTAL_EXAM_SCORE : essayMax > TOTAL_EXAM_SCORE)
    return hasMcq
      ? `Đề có cả trắc nghiệm: tổng điểm tự luận phải nhỏ hơn ${TOTAL_EXAM_SCORE} để còn điểm cho trắc nghiệm (hiện là ${essayMax}).`
      : `Đề toàn tự luận: tổng điểm tự luận không được vượt quá ${TOTAL_EXAM_SCORE} (hiện là ${essayMax}).`;
  return '';
}

export function remainingScore({ essayMax, hasMcq }: { essayMax: number; hasMcq: boolean }) {
  const remaining = roundScore(TOTAL_EXAM_SCORE - essayMax);
  return {
    remaining,
    label: `${hasMcq ? 'Điểm còn lại cho trắc nghiệm' : 'Điểm tự luận còn lại'}: ${remaining}`,
  };
}

/** Highest points the essay at `index` may have (without its own current points). */
export function maxAllowedForQuestion({
  questions,
  index,
}: {
  questions: EditorQuestion[];
  index: number;
}): number {
  const { essayMax } = computeScoringPreview(questions);
  return roundScore(TOTAL_EXAM_SCORE - (essayMax - questionPoints(questions[index])));
}

/** Error at the score box when over the allowed limit: strict (mixed exam) needs value < limit, else value <= limit. */
export function essayScoreError(
  value: unknown,
  { limit, strict }: { limit: number; strict: boolean },
): string {
  const n = Number(value);
  if (!isValidScore(value) || (strict ? n < limit : n <= limit)) return '';
  return strict
    ? `Vượt mức: tổng tự luận phải nhỏ hơn ${TOTAL_EXAM_SCORE}, câu này chỉ được nhỏ hơn ${limit} điểm.`
    : `Vượt mức: câu này tối đa ${limit} điểm (tổng tự luận không vượt quá ${TOTAL_EXAM_SCORE}).`;
}

/** 'q:7:criteria:0:max' -> { 'criteria:0:max': ... } for one question. */
export const questionErrorsOf = (
  errors: Record<string, string> | undefined,
  questionId: number,
) => {
  const prefix = `q:${questionId}:`;
  return Object.fromEntries(
    Object.entries(errors ?? {})
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, m]) => [k.slice(prefix.length), m]),
  );
};

/** Errors of all questions (Vietnamese), keyed per field; the first message per key wins; `_scoring` (total) comes last. */
export function validateQuestions(questions: EditorQuestion[] | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  const put = (key: string, message: string) => {
    if (!errors[key]) errors[key] = message;
  };
  (questions ?? []).forEach((q, idx) => {
    const number = idx + 1;
    const key = (field: string) => `q:${q.id}:${field}`;
    if (q.needsReview)
      put(
        key('review'),
        `Câu ${number}: cần xác nhận loại câu hỏi (bấm "Xác nhận" hoặc chọn loại Trắc nghiệm/Tự luận).`,
      );
    if (isEssay(q)) {
      if (!String(q.questionText ?? '').trim() && !String(q.requirements ?? '').trim())
        put(key('text'), `Câu ${number}: câu tự luận phải có đề bài hoặc yêu cầu.`);
      const rubric = q.rubric ?? [];
      if (rubric.length === 0)
        put(key('criteria'), `Câu ${number}: tiêu chí chấm không được rỗng.`);
      const keys = new Set<string>();
      rubric.forEach((item, rIdx) => {
        if (!String(item.label ?? '').trim())
          put(key(`criteria:${rIdx}:label`), `Câu ${number}: tiêu chí ${rIdx + 1} chưa có tên.`);
        const max = Number(item.max);
        if (!Number.isFinite(max) || max <= 0)
          put(
            key(`criteria:${rIdx}:max`),
            `Câu ${number}: tiêu chí ${rIdx + 1} phải có điểm tối đa lớn hơn 0.`,
          );
        else if (!isQuarterStep(max))
          put(
            key(`criteria:${rIdx}:max`),
            `Câu ${number}: điểm tiêu chí ${rIdx + 1} phải là bội số của ${RUBRIC_STEP}.`,
          );
        if (keys.has(item.key))
          put(key('criteria'), `Câu ${number}: tiêu chí ${rIdx + 1} bị trùng mã.`);
        keys.add(item.key);
      });
      const questionMax = Number(q.maxScore);
      if (!Number.isFinite(questionMax) || questionMax <= 0 || !isQuarterStep(questionMax))
        put(
          key('score'),
          `Câu ${number}: điểm của câu phải lớn hơn 0 và là bội số của ${RUBRIC_STEP}.`,
        );
      else if (Math.abs(sumRubric(rubric) - questionMax) > 1e-9)
        put(
          key('score'),
          `Câu ${number}: tổng điểm các tiêu chí (${sumRubric(rubric)}) phải bằng điểm của câu (${questionMax}).`,
        );
      return;
    }
    if (!q.options?.A?.trim() || !q.options?.B?.trim())
      put(key('options'), `Câu ${number}: phải nhập ít nhất phương án A và B.`);
    if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer))
      put(key('correct'), `Câu ${number}: chưa chọn đáp án đúng.`);
    else if (!q.options?.[q.correctAnswer as OptionKey]?.trim())
      put(
        key('correct'),
        `Câu ${number}: đáp án đúng là ${q.correctAnswer} nhưng phương án ${q.correctAnswer} đang để trống.`,
      );
  });
  const { essayMax } = computeScoringPreview(questions);
  const scoringError = describeEssayTotalError({
    essayMax,
    hasMcq: (questions ?? []).some((q) => !isEssay(q)),
  });
  if (scoringError) put('_scoring', scoringError);
  return errors;
}

/** Payload question for the server: no UI-only flags, essay without options/answer, maxScore = rubric sum. */
export function toPayloadQuestion(q: EditorQuestion): Record<string, unknown> {
  if (isEssay(q))
    return {
      id: q.id,
      type: 'essay',
      context: q.context ?? '',
      questionText: q.questionText ?? '',
      requirements: q.requirements ?? '',
      rubric: (q.rubric ?? []).map((i) => ({
        key: i.key,
        label: String(i.label ?? '').trim(),
        max: Number(i.max),
      })),
      maxScore: sumRubric(q.rubric),
      explanation: q.explanation ?? '',
    };
  return {
    id: q.id,
    context: q.context ?? '',
    questionText: q.questionText ?? '',
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? '',
  };
}

/**
 * Every question gets a positive, UNIQUE integer id. Ids key the stored answers, so they are fixed only here at load,
 * never renumbered when the teacher adds or removes questions.
 */
export function ensureUniqueIds(list: Raw[] = []): EditorQuestion[] {
  const used = new Set<number>();
  let nextId = 1;
  return list.map((q) => {
    let id = Number(q.id);
    if (!Number.isInteger(id) || id < 1 || used.has(id)) {
      while (used.has(nextId)) nextId += 1;
      id = nextId;
    }
    used.add(id);
    nextId = Math.max(nextId, id + 1);
    return normalizeEditorQuestion(q, id);
  });
}
