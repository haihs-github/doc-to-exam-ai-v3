// Created by Haihs on 13/11/2026
// Pure tests: question validation, scoring scale, mcq grading with shuffled options, shuffling, copy names, regrade signature.
import { describe, expect, it } from 'vitest';
import { buildCopyTitle, stripCopySuffix } from '../src/lib/examCopyName';
import {
  generateShuffledOptionsOrder,
  generateShuffledQuestionOrder,
  canShuffleOptions,
} from '../src/lib/examShuffle';
import {
  buildEssayRubric,
  computeScoring,
  gradeSubmission,
  mapByOptionsOrder,
  sanitizeAnswers,
  sanitizeQuestions,
  validateExamSchedule,
  type Question,
} from '../src/lib/examValidation';
import { essaySignature } from '../src/services/regrade';
import { classifySubmission, computeResultScores } from '../src/services/resultPublication';
import { computeEssayDisplay, summarizeStats } from '../src/services/essayDisplay';

const mcq = (id: number, correct = 'B', over: Record<string, unknown> = {}) => ({
  id,
  questionText: `q${id}`,
  options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  correctAnswer: correct,
  ...over,
});
const essay = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  type: 'essay',
  questionText: 'Write',
  rubric: [
    { key: 'k1', label: 'One', max: 1 },
    { key: 'k2', label: 'Two', max: 1.5 },
  ],
  maxScore: 2.5,
  ...over,
});

describe('sanitizeQuestions', () => {
  it('rejects empty, duplicate and invalid ids, missing options/answer', () => {
    expect(sanitizeQuestions([]).errors[0]).toMatch(/ít nhất 1 câu/);
    expect(sanitizeQuestions([mcq(1), mcq(1)]).errors.join(' ')).toMatch(/bị trùng/);
    expect(sanitizeQuestions([{ ...mcq(1), id: 0 }]).errors.join(' ')).toMatch(/thiếu mã/);
    expect(sanitizeQuestions([mcq(1, 'B', { options: { A: 'a' } })]).errors.join(' ')).toMatch(
      /phương án A và B/,
    );
    expect(sanitizeQuestions([mcq(1, 'Z')]).errors.join(' ')).toMatch(
      /đáp án đúng phải là A, B, C hoặc D/,
    );
    expect(
      sanitizeQuestions([mcq(1, 'C', { options: { A: 'a', B: 'b' } })]).errors.join(' '),
    ).toMatch(/phương án C đang để trống/);
  });
  it('keeps ids (no renumbering) and normalises text', () => {
    const { questions, errors } = sanitizeQuestions([mcq(7, 'b', { questionText: '  hi  ' })]);
    expect(errors).toEqual([]);
    expect(questions[0]).toMatchObject({ id: 7, questionText: 'hi', correctAnswer: 'B' });
  });
  it('needsReview blocks only while the data is still incomplete', () => {
    expect(sanitizeQuestions([mcq(1, 'B', { needsReview: true })]).errors).toEqual([]);
    expect(sanitizeQuestions([mcq(1, '', { needsReview: true })]).errors.join(' ')).toMatch(
      /chưa được xác nhận loại/,
    );
  });
  it('essay: default rubric, rubric sum must equal maxScore, step 0.25, total < 10 with mcq', () => {
    const ok = sanitizeQuestions([mcq(1), essay(2)]);
    expect(ok.errors).toEqual([]);
    expect(buildEssayRubric([], undefined).maxScore).toBe(2.5);
    expect(buildEssayRubric([{ key: 'a', label: 'x', max: 0.3 }], 0.3).errors.join(' ')).toMatch(
      /bội số của 0.25/,
    );
    expect(sanitizeQuestions([essay(1, { maxScore: 9 })]).errors.join(' ')).toMatch(
      /phải bằng điểm tối đa/,
    );
    expect(
      sanitizeQuestions([
        mcq(1),
        essay(2, { rubric: [{ key: 'a', label: 'x', max: 10 }], maxScore: 10 }),
      ]).errors.join(' '),
    ).toMatch(/Đề có cả trắc nghiệm/);
    expect(
      sanitizeQuestions([essay(2, { rubric: [{ key: 'a', label: 'x', max: 10 }], maxScore: 10 })])
        .errors,
    ).toEqual([]);
  });
});

describe('computeScoring / gradeSubmission', () => {
  it('scale: all mcq 10; mixed 10 - essay; all essay 0 mcq', () => {
    expect(computeScoring([mcq(1)])).toEqual({ mcqMax: 10, essayMax: 0, total: 10 });
    expect(computeScoring([mcq(1), essay(2)])).toEqual({ mcqMax: 7.5, essayMax: 2.5, total: 10 });
    expect(computeScoring([essay(1)])).toEqual({ mcqMax: 0, essayMax: 2.5, total: 2.5 });
  });
  it('grades by the DISPLAYED options when shuffled and ignores unknown/invalid answers', () => {
    const qs = [mcq(1, 'B'), mcq(2, 'A')] as unknown as Question[];
    // q1: display A shows original B => the student picks A. q2 unshuffled, correct A.
    const order = { '1': ['B', 'A', 'C', 'D'] };
    const r = gradeSubmission(qs, { '1': 'A', '2': 'A', '99': 'A', '3': 'Z' }, order);
    expect(r).toEqual({ correctCount: 2, totalQuestions: 2, score: 10 });
    expect(gradeSubmission(qs, { '1': 'B' }, order).correctCount).toBe(0);
    expect(sanitizeAnswers({ '1': 'a', '2': 'X', '5': 'A' }, qs)).toEqual({ '1': 'A' });
  });
  it('mapByOptionsOrder ignores prototype keys', () => {
    const m = mapByOptionsOrder(
      { options: { A: 'a', B: 'b' }, correctAnswer: 'A' },
      ['constructor', '__proto__', 'A', 'B'],
      'A',
    );
    expect(m.displayOptions.A).toBe('');
    expect(m.displayOptions.C).toBe('a');
  });
  it('score for a mixed exam is mcq share + essay', () => {
    const qs = [mcq(1), mcq(2), essay(3)] as unknown as Question[];
    expect(gradeSubmission(qs, { '1': 'B' }, {}).score).toBe(3.75);
  });
});

describe('validateExamSchedule', () => {
  it('checks duration and order', () => {
    expect(
      validateExamSchedule({ durationMinutes: 0, startTime: '2026-01-01', endTime: '2026-01-02' })
        .errors[0],
    ).toMatch(/lớn hơn 0/);
    expect(
      validateExamSchedule({ durationMinutes: 601, startTime: '2026-01-01', endTime: '2026-01-02' })
        .errors[0],
    ).toMatch(/tối đa là 600/);
    expect(
      validateExamSchedule({ durationMinutes: 10, startTime: '2026-01-02', endTime: '2026-01-01' })
        .errors[0],
    ).toMatch(/trước/);
    expect(
      validateExamSchedule({ durationMinutes: 10, startTime: 'x', endTime: '2026-01-01' })
        .errors[0],
    ).toMatch(/mở đề không hợp lệ/);
  });
});

describe('shuffle', () => {
  it('keeps reading-passage blocks together and is a permutation', () => {
    const qs = [1, 2, 3, 4, 5, 6].map((id) => ({
      id,
      context: id <= 3 ? 'passage A' : id <= 5 ? 'passage B' : '',
    }));
    for (let i = 0; i < 30; i += 1) {
      const order = generateShuffledQuestionOrder(qs);
      expect([...order].sort()).toEqual([1, 2, 3, 4, 5, 6]);
      const pos = (id: number) => order.indexOf(id);
      const span = (ids: number[]) => Math.max(...ids.map(pos)) - Math.min(...ids.map(pos));
      expect(span([1, 2, 3])).toBe(2);
      expect(span([4, 5])).toBe(1);
    }
  });
  it('does not shuffle options that refer to each other and keeps empty slots last', () => {
    expect(canShuffleOptions({ id: 1, options: { A: 'A and B', B: 'x', C: 'y', D: 'z' } })).toBe(
      false,
    );
    expect(canShuffleOptions({ id: 1, options: { A: 'all of the above', B: 'x' } })).toBe(false);
    const order = generateShuffledOptionsOrder([
      { id: 1, options: { A: 'a', B: 'b', C: '', D: '' } },
    ]);
    expect(new Set(order['1'].slice(0, 2))).toEqual(new Set(['A', 'B']));
    expect(order['1'].slice(2)).toEqual(['C', 'D']);
  });
});

describe('copy names', () => {
  it('strips and rebuilds the "(bản sao N)" suffix within the cap', () => {
    expect(stripCopySuffix('Đề (bản sao 3)')).toBe('Đề');
    expect(buildCopyTitle('Đề', 1)).toBe('Đề (bản sao)');
    expect(buildCopyTitle('Đề', 2)).toBe('Đề (bản sao 2)');
    expect(buildCopyTitle('x'.repeat(300), 2, 50).length).toBe(50);
  });
});

describe('publication helpers', () => {
  const qs = [mcq(1), essay(2)] as unknown as Question[];
  it('classifySubmission: ready only with every essay graded against the CURRENT rubric', () => {
    expect(classifySubmission(qs, { essayResults: [] }).status).toBe('ungraded');
    const good = {
      essayResults: [{ questionId: 2, criteria: [{ key: 'k1' }, { key: 'k2' }], total: 2 }],
    };
    expect(classifySubmission(qs, good).status).toBe('ready');
    const wrongKeys = { essayResults: [{ questionId: 2, criteria: [{ key: 'k1' }], total: 1 }] };
    expect(classifySubmission(qs, wrongKeys).status).toBe('ungraded');
    expect(classifySubmission(qs, { ...good, essayStale: true }).stale).toBe(true);
  });
  it('computeResultScores clamps essay by maxScore and total by the exam total', () => {
    const r = computeResultScores(qs, {
      answers: { '1': 'B' },
      essayResults: [{ questionId: 2, total: 99 }],
    });
    expect(r).toMatchObject({ essayScore: 2.5, mcqScore: 7.5, score: 10, maxScore: 10 });
  });
  it('computeEssayDisplay: total only when every essay is graded; stats skip ungraded', () => {
    expect(
      computeEssayDisplay({ gradingStatus: 'pending', essayResults: [], score: 3 }, qs),
    ).toMatchObject({ essayGraded: false, totalScore: null, gradingLabelCode: 'ungraded' });
    expect(
      computeEssayDisplay(
        { gradingStatus: 'done', essayResults: [{ questionId: 2 }], score: 9 },
        qs,
      ),
    ).toMatchObject({ essayGraded: true, totalScore: 9, gradingLabelCode: 'teacher' });
    expect(
      computeEssayDisplay({ gradingStatus: 'none', score: 5 }, [mcq(1)] as never),
    ).toMatchObject({ hasEssay: false, totalScore: 5 });
    expect(summarizeStats([{ totalScore: 4 }, { totalScore: null }, { totalScore: 8 }])).toEqual({
      gradedSubmissions: 2,
      avgScore: 6,
      maxScore: 8,
      minScore: 4,
    });
  });
  it('essaySignature changes with essay content and rubric only', () => {
    const a = essaySignature([mcq(1), essay(2)]);
    expect(essaySignature([mcq(1, 'C'), essay(2)])).toBe(a);
    expect(essaySignature([mcq(1), essay(2, { questionText: 'Other' })])).not.toBe(a);
  });
});
