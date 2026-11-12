// Created by Haihs on 12/11/2026
// Question sub-schema shared by ExamTemplate and ExamSitting. Port of server/models/schemas/questionSchema.js.
import { Schema } from 'mongoose';

// A, B and the answer are required for mcq only (essay questions have no options).
function isMcqQuestion(this: { type?: string }): boolean {
  return this.type !== 'essay';
}

export const QuestionSchema = new Schema(
  {
    // Stable id inside the exam: NEVER renumbered, submitted answers are keyed by it.
    id: { type: Number, required: true, min: [1, 'ID câu hỏi phải lớn hơn 0'] },
    questionText: { type: String, default: '' },
    context: { type: String, default: '' },
    type: { type: String, enum: ['mcq', 'essay'], default: 'mcq' },
    requirements: { type: String, default: '' },
    rubric: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            label: { type: String, default: '' },
            max: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    maxScore: { type: Number, default: undefined, min: 0 },
    options: {
      A: { type: String, required: [isMcqQuestion, 'Phương án A không được để trống'] },
      B: { type: String, required: [isMcqQuestion, 'Phương án B không được để trống'] },
      C: { type: String, default: '' },
      D: { type: String, default: '' },
    },
    correctAnswer: {
      type: String,
      required: [isMcqQuestion, 'Đáp án đúng là bắt buộc'],
      uppercase: true,
      trim: true,
      enum: {
        values: ['A', 'B', 'C', 'D'],
        message: 'Đáp án đúng chỉ được là A, B, C hoặc D (nhận được: "{VALUE}")',
      },
    },
    explanation: { type: String, default: '' },
  },
  { _id: false },
);
